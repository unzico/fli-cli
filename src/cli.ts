#!/usr/bin/env bun
import { Command } from "commander";
import * as ts from "typescript";
import type { FliConfig } from "./index";

const program = new Command();

program
    .name("fli-cli")
    .description("Build tool for fli-cli applications")
    .command("build [entry]")
    .description("Build the CLI into a standalone executable")
    .action(async (entryVal = "index.ts") => {
        const cwd = process.cwd();
        const entryPath = entryVal.startsWith("/") ? entryVal : `${cwd}/${entryVal}`;
        console.log(`Building CLI from ${entryPath}...`);

        const module = await import(entryPath);
        const config: FliConfig = module.default;

        if (!config || !config.baseDir) {
            console.error("Error: Default export with baseDir is required in the entry file.");
            process.exit(1);
        }

        const entryDir = entryPath.substring(0, entryPath.lastIndexOf("/"));
        const baseDir = config.baseDir.startsWith("/") ? config.baseDir : `${entryDir}/${config.baseDir}`;

        const files: string[] = [];
        const glob = new Bun.Glob("**/*.{ts,js}");

        for await (const file of glob.scan({ cwd: baseDir })) {
            if (!file.startsWith("_") && !file.includes("/_")) {
                files.push(file);
            }
        }

        // --- Code Generation ---
        const importStatements: string[] = [`import { Command } from "commander";`];
        const setupStatements: string[] = [
            `const program = new Command();`,
            `program.name("${config.name || "cli"}");`,
        ];

        // Helper to track which command variables exist
        // Map<LogicalPath, VariableName>
        // Root is "" -> "program"
        const commandVars = new Map<string, string>();
        commandVars.set("", "program");

        let varCounter = 0;
        const nextVar = () => `cmd_${++varCounter}`;

        // Sort files to process directories before leaves roughly, though logic should handle any order
        files.sort();

        for (const file of files) {
            const cleanPath = file.replace(/\.(ts|js)$/, ""); // remove extension
            const parts = cleanPath.split("/");
            const isIndex = parts[parts.length - 1] === "index";
            const dirParts = isIndex ? parts.slice(0, -1) : parts.slice(0, -1);
            let currentPath = "";
            let parentVar = "program";

            // Create structure for directories
            for (const part of dirParts) {
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!commandVars.has(currentPath)) {
                    const newVar = nextVar();
                    commandVars.set(currentPath, newVar);
                    const cmdName = part;
                    setupStatements.push(`const ${newVar} = ${commandVars.get(parentPath)}.command("${cmdName}");`);
                }
                parentVar = commandVars.get(currentPath)!;
            }

            const fullPath = `${baseDir}/${file}`;
            const fileVar = `mod_${varCounter}_${cleanPath.replace(/\//g, "_")}`;
            const fileContent = await Bun.file(fullPath).text();
            const meta = extractMetadata(fullPath, fileContent);

            importStatements.push(`import * as ${fileVar} from "${fullPath}";`);

            // Determine which command variable this file configures
            let targetVar: string;
            if (isIndex) {
                // It configures the directory's command (which might just have been created or exists)
                // If root index.ts
                if (dirParts.length === 0) {
                    targetVar = "program";
                } else {
                    targetVar = commandVars.get(dirParts.join("/"))!;
                }
            } else {
                // It's a leaf command file (e.g. "migrate.ts" inside "db")
                // We need to create a new command for it
                const name = parts[parts.length - 1];
                const cmdName = name;

                // Parent is the directory command
                const parentPath = dirParts.join("/");
                const pVar = commandVars.get(parentPath)!;

                targetVar = nextVar();
                setupStatements.push(`const ${targetVar} = ${pVar}.command("${cmdName}");`);
            }

            // Now apply the module to the targetVar command
            // 1. Default export (action)
            if (meta.hasDefault) {
                const defaultArgs = meta.arguments.find((a) => a.functionName === "default");

                // Configure argument
                if (defaultArgs && defaultArgs.type !== "array") {
                    // Single argument mode
                    const argName = defaultArgs.name;
                    const argDef = defaultArgs.isRequired ? `<${argName}>` : `[${argName}]`;
                    setupStatements.push(`${targetVar}.argument("${argDef}");`);
                } else {
                    // Array/Rest mode (default behavior)
                    setupStatements.push(`${targetVar}.argument("[args...]");`);
                }

                setupStatements.push(`
    ${targetVar}.action(async (args, options, command) => {
        let parsedArgs = args;
        // Coercion logic for single argument
        const argMeta = meta_${varCounter}.arguments.find(a => a.functionName === "default");
        if (argMeta && argMeta.type !== "array") {
             if (argMeta.type === "number") {
                 parsedArgs = Number(args);
             } else if (argMeta.type === "boolean") {
                 parsedArgs = (args === "true" || args === "1" || args === "on");
             }
        }
        
        // Coercion logic for flags
        const flagMeta = meta_${varCounter}.flags.filter(f => f.functionName === "default");
        for (const flag of flagMeta) {
             if (flag.type === "number" && options[flag.name] !== undefined) {
                 options[flag.name] = Number(options[flag.name]);
             }
        }
        await ${fileVar}.default.call({ options }, parsedArgs, options);
    });
`);
            }

            // 2. Flags from default export
            // We need to find flags for "default"
            const defaultFlags = meta.flags.filter(
                (f) => f.functionName === "default" || f.functionName === "undefined",
            );
            for (const flag of defaultFlags) {
                const flagName = toKebabCase(flag.name);
                const desc = flag.description || "";
                if (flag.type === "boolean") {
                    setupStatements.push(`${targetVar}.option("--${flagName}", "${desc}");`);
                } else {
                    setupStatements.push(`${targetVar}.option("--${flagName} <value>", "${desc}");`);
                }
            }

            setupStatements.push(`
const meta_${varCounter} = ${JSON.stringify(meta)};
for (const [key, val] of Object.entries(${fileVar})) {
    if (key === "default" || key.startsWith("_")) continue;
    if (typeof val === "function") {
                const k = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

                let subCmd;
                try { subCmd = ${targetVar}.commands.find(c => c.name() === k); } catch (e) { }
                if (!subCmd) subCmd = ${targetVar}.command(k);

                const argMeta = meta_${varCounter}.arguments.find(a => a.functionName === key);
                if (argMeta && argMeta.type !== "array") {
                     const argDef = argMeta.isRequired ? "<" + argMeta.name + ">" : "[" + argMeta.name + "]";
                     subCmd.argument(argDef);
                } else {
                     subCmd.argument("[args...]");
                }

                const flags = meta_${varCounter}.flags.filter(f => f.functionName === key);
                for (const flag of flags) {
                    const flagName = flag.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
                    if (flag.type === "boolean") subCmd.option("--" + flagName, flag.description);
                    else subCmd.option("--" + flagName + " <value>", flag.description);
                }

                subCmd.action(async (args, options) => {
                    let parsedArgs = args;
                     if (argMeta && argMeta.type !== "array") {
                         if (argMeta.type === "number") {
                             parsedArgs = Number(args);
                         } else if (argMeta.type === "boolean") {
                             parsedArgs = (args === "true" || args === "1" || args === "on" || args === "true");
                         }
                    }

                    // Coerce flags
                    const flagMeta = meta_${varCounter}.flags.filter(f => f.functionName === key);
                    for (const flag of flagMeta) {
                         if (flag.type === "number" && options[flag.name] !== undefined) {
                             options[flag.name] = Number(options[flag.name]);
                         }
                    }
                    await val.call({ options }, parsedArgs, options);
                });
            }
        }
        `);
        }

        setupStatements.push(`program.parse(process.argv); `);

        const generatedCode = `
${importStatements.join("\n")}

${setupStatements.join("\n")}
        `;

        const tempFile = `${cwd}/.fli-entry.ts`;
        await Bun.write(tempFile, generatedCode);

        try {
            console.log("Compiling...");
            const proc = Bun.spawn(["bun", "build", tempFile, "--compile", "--outfile", config.name || "cli"], {
                stdio: ["inherit", "inherit", "inherit"],
            });
            await proc.exited;

            if (proc.exitCode === 0) {
                console.log(`Successfully built ${config.name || "cli"}`);
            } else {
                console.error(`Build failed with code ${proc.exitCode}`);
                process.exit(1);
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        } finally {
            const rmProc = Bun.spawn(["rm", tempFile]);
            await rmProc.exited;
        }
    });

program.parse(process.argv);

function extractMetadata(fileName: string, content: string) {
    const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
    const meta: { flags: any[]; arguments: any[]; hasDefault: boolean } = {
        flags: [],
        arguments: [],
        hasDefault: false,
    };

    function visit(node: ts.Node) {
        if (ts.isExportAssignment(node)) {
            meta.hasDefault = true;
        }
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
            const functionName = node.name?.text || "default";

            // Check if it's a default export
            if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
                meta.hasDefault = true;
            }

            // Extract argument info (first parameter)
            if (node.parameters.length > 0) {
                const firstParam = node.parameters[0]!;
                const paramName = firstParam.name.getText();
                let paramType = "string"; // default
                let isArray = false;

                if (firstParam.type) {
                    if (firstParam.type.kind === ts.SyntaxKind.NumberKeyword) paramType = "number";
                    else if (firstParam.type.kind === ts.SyntaxKind.BooleanKeyword) paramType = "boolean";
                    else if (firstParam.type.kind === ts.SyntaxKind.ArrayType || ts.isArrayTypeNode(firstParam.type)) {
                        paramType = "array";
                        isArray = true;
                    } else if (
                        ts.isTypeReferenceNode(firstParam.type) &&
                        firstParam.type.typeName.getText() === "Array"
                    ) {
                        paramType = "array";
                        isArray = true;
                    }
                }

                const isRequired = !firstParam.questionToken && !firstParam.initializer;

                meta.arguments.push({
                    functionName,
                    name: paramName,
                    type: paramType,
                    isRequired,
                });
            }

            if (node.parameters.length >= 2) {
                const flagsParam = node.parameters[1]!;
                if (flagsParam.type && ts.isTypeLiteralNode(flagsParam.type)) {
                    flagsParam.type.members.forEach((member) => {
                        if (ts.isPropertySignature(member)) {
                            const flagName = member.name.getText();
                            let flagType = "string";
                            if (member.type) {
                                if (member.type.kind === ts.SyntaxKind.BooleanKeyword) flagType = "boolean";
                                else if (member.type.kind === ts.SyntaxKind.NumberKeyword) flagType = "number";
                            }

                            const fullText = sourceFile.getFullText();
                            const memberStart = member.getFullStart();
                            const nameStart = member.name.getStart();
                            const commentRange = fullText.substring(memberStart, nameStart).trim();

                            const description = commentRange
                                .replace(/^\/\*\*/, "")
                                .replace(/\*\/$/, "")
                                .replace(/\*/g, "")
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean)
                                .join(" ");

                            meta.flags.push({
                                functionName: node.name?.text || "default",
                                name: flagName,
                                type: flagType,
                                description,
                            });
                        }
                    });
                }
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return meta;
}

function toKebabCase(str: string) {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
