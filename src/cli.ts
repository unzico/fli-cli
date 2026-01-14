#!/usr/bin/env bun
import { Command } from "commander";
import * as ts from "typescript";
import { watch } from "node:fs";
import { unlink } from "node:fs/promises";
import type { FliConfig } from "./index";

const program = new Command();

program.name("fli-cli").description("Build tool for fli-cli applications");

program
    .command("build [entry]")
    .description("Build the CLI into a standalone executable")
    .option("--baseDir <path>", "Base directory for source files")
    .option("--name <name>", "Name of the output CLI")
    .action(async (entryVal: string | undefined, options: { baseDir?: string; name?: string }) => {
        await buildCLI(entryVal, options);
    });

program
    .command("watch <glob> [entry]")
    .description("Watch for changes and rebuild the CLI")
    .option("--baseDir <path>", "Base directory for source files")
    .option("--name <name>", "Name of the output CLI")
    .action(async (globPattern: string, entryVal: string | undefined, options: { baseDir?: string; name?: string }) => {
        // Initial build
        await buildCLI(entryVal, options);

        console.log(`\nWatching for changes matching: ${globPattern}`);
        console.log("Press Ctrl+C to stop.\n");

        const glob = new Bun.Glob(globPattern);

        // Simple debounce to prevent double-builds
        let isBuilding = false;
        let pendingBuild = false;

        const triggerBuild = async () => {
            if (isBuilding) {
                pendingBuild = true;
                return;
            }

            isBuilding = true;
            console.log("Change detected, rebuilding...");
            try {
                await buildCLI(entryVal, options);
            } catch (e) {
                console.error("Build failed:", e);
            } finally {
                isBuilding = false;
                if (pendingBuild) {
                    pendingBuild = false;
                    triggerBuild();
                }
            }
        };

        const debouncedBuild = debounce(triggerBuild, 200);

        const watcher = watch(process.cwd(), { recursive: true }, (_, filename) => {
            if (filename && glob.match(filename)) {
                debouncedBuild();
            }
        });

        const teardown = () => {
            console.log("\nStopping watch mode...");
            watcher.close();
            process.exit(0);
        };

        process.on("SIGINT", teardown);
        process.on("SIGTERM", teardown);
    });

program.parse(process.argv);

async function buildCLI(entryVal: string | undefined, options: { baseDir?: string; name?: string }) {
    const cwd = process.cwd();
    const cannotMixEntryFileAndFlags = entryVal && (options.baseDir || options.name);

    if (cannotMixEntryFileAndFlags) {
        console.error("Error: Cannot use flags (--baseDir, --name) when an entry file is provided.");
        console.error("Please either configure via the entry file OR use flags directly.");
        process.exit(1);
    }

    let config: FliConfig;
    let entryDir: string;

    if (entryVal) {
        // MODE 1: Entry File Configuration
        const entryPath = entryVal.startsWith("/") ? entryVal : `${cwd}/${entryVal}`;

        try {
            const module = await import(entryPath);
            config = module.default;
        } catch (e) {
            console.error(`Error loading entry file: ${entryPath}`);
            console.error(e);
            process.exit(1);
        }

        if (!config || !config.baseDir) {
            console.error("Error: Default export with baseDir is required in the entry file.");
            process.exit(1);
        }

        // In entry file mode, baseDir is relative to the entry file's directory
        entryDir = entryPath.substring(0, entryPath.lastIndexOf("/"));
    } else {
        // MODE 2: Flag/Default Configuration
        config = {
            baseDir: options.baseDir || "src",
            name: options.name || "cli",
        };
        // In flag mode, baseDir is relative to CWD
        entryDir = cwd;
    }

    const baseDir = config.baseDir?.startsWith("/") ? config.baseDir : `${entryDir}/${config.baseDir}`;

    const files: string[] = [];
    const glob = new Bun.Glob("**/*.{ts,js}");

    try {
        for await (const file of glob.scan({ cwd: baseDir })) {
            if (!file.startsWith("_") && !file.includes("/_")) {
                files.push(file);
            }
        }
    } catch (e) {
        console.error(`Error searching for files in ${baseDir}:`);
        console.error(e);
        process.exit(1);
    }

    if (files.length === 0) {
        console.warn(`Warning: No source files found in ${baseDir}`);
    }

    // --- Code Generation ---
    const importStatements: string[] = [`import { Command } from "commander";`];
    const setupStatements: string[] = [`const program = new Command();`, `program.name("${config.name || "cli"}");`];

    // Helper to track which command variables exist
    // Map<LogicalPath, VariableName>
    // Root is "" -> "program"
    const commandVars = new Map<string, string>();
    commandVars.set("", "program");

    let varCounter = 0;
    const nextVar = () => `cmd_${++varCounter}`;

    // FILE COUNTER for uniqueness of file metadata variables
    let fileCounter = 0;

    // Sort files to process directories before leaves roughly, though logic should handle any order
    files.sort();

    for (const file of files) {
        fileCounter++; // Increment file counter for each file
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
                const cmdName = toKebabCase(part);
                setupStatements.push(`const ${newVar} = ${commandVars.get(parentPath)}.command("${cmdName}");`);
            }
            parentVar = commandVars.get(currentPath)!;
        }

        const fullPath = `${baseDir}/${file}`;
        const fileVar = `mod_${fileCounter}_${cleanPath.replace(/[^a-zA-Z0-9]/g, "_")}`;
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
            const cmdName = toKebabCase(name || "");

            // Parent is the directory command
            const parentPath = dirParts.join("/");
            const pVar = commandVars.get(parentPath)!;

            targetVar = nextVar();
            setupStatements.push(`const ${targetVar} = ${pVar}.command("${cmdName}");`);
        }

        // Now apply the module to the targetVar command
        // 1. Default export (action)
        if (meta.hasDefault) {
            if (meta.descriptions["default"]) {
                setupStatements.push(`${targetVar}.description(${JSON.stringify(meta.descriptions["default"])});`);
            }

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
    const argMeta = meta_${fileCounter}.arguments.find(a => a.functionName === "default");
    if (argMeta && argMeta.type !== "array") {
         if (argMeta.type === "number") {
             parsedArgs = Number(args);
         } else if (argMeta.type === "boolean") {
             parsedArgs = (args === "true" || args === "1" || args === "on");
         }
    }
    
    // Coercion logic for flags
    const flagMeta = meta_${fileCounter}.flags.filter(f => f.functionName === "default");
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
        // We need to find flags for "default"
        const defaultFlags = meta.flags.filter((f) => f.functionName === "default" || f.functionName === "undefined");
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
const meta_${fileCounter} = ${JSON.stringify(meta)};
for (const [key, val] of Object.entries(${fileVar})) {
if (key === "default" || key.startsWith("_")) continue;
if (typeof val === "function") {
            const k = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

            let subCmd;
            try { subCmd = ${targetVar}.commands.find(c => c.name() === k); } catch (e) { }
            if (!subCmd) subCmd = ${targetVar}.command(k);

            // Set description if available
            if (meta_${fileCounter}.descriptions[key]) {
                subCmd.description(meta_${fileCounter}.descriptions[key]);
            }

            const argMeta = meta_${fileCounter}.arguments.find(a => a.functionName === key);
            if (argMeta && argMeta.type !== "array") {
                 const argDef = argMeta.isRequired ? "<" + argMeta.name + ">" : "[" + argMeta.name + "]";
                 subCmd.argument(argDef);
            } else {
                 subCmd.argument("[args...]");
            }

            const flags = meta_${fileCounter}.flags.filter(f => f.functionName === key);
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
                const flagMeta = meta_${fileCounter}.flags.filter(f => f.functionName === key);
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

    const uniqueId = Math.random().toString(36).substring(2, 8);
    const tempFile = `${cwd}/.fli-entry-${uniqueId}.ts`;
    await Bun.write(tempFile, generatedCode);

    try {
        const proc = Bun.spawn(["bun", "build", tempFile, "--compile", "--outfile", config.name || "cli"], {
            stdio: ["inherit", "inherit", "inherit"],
        });
        await proc.exited;

        if (proc.exitCode === 0) {
            console.log(`Successfully built ${config.name || "cli"}`);
        } else {
            console.error(`Build failed with code ${proc.exitCode}`);
            throw new Error(`Build process exited with code ${proc.exitCode}`);
        }
    } catch (e) {
        throw e;
    } finally {
        try {
            // Use unlink to remove the temporary file.
            // Simpler and more reliable than spawning a process
            await unlink(tempFile);
        } catch (e) {
            // Ignore error if file doesn't exist
        }
    }
}

function extractMetadata(fileName: string, content: string) {
    const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
    const meta: { flags: any[]; arguments: any[]; hasDefault: boolean; descriptions: Record<string, string> } = {
        flags: [],
        arguments: [],
        hasDefault: false,
        descriptions: {},
    };

    function visit(node: ts.Node) {
        if (ts.isExportAssignment(node)) {
            meta.hasDefault = true;
        }
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
            let functionName = node.name?.text || "default";

            // Check if it's a default export
            if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
                meta.hasDefault = true;
                functionName = "default";
            }

            // Extract Description
            const fullText = sourceFile.getFullText();
            const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
            if (ranges && ranges.length > 0) {
                // Use the last comment range before the node (usually the JSDoc)
                const range = ranges[ranges.length - 1];
                if (range) {
                    const comment = fullText.substring(range.pos, range.end);
                    if (comment.startsWith("/**")) {
                        const cleanDescription = comment
                            .replace(/^\/\*\*/, "")
                            .replace(/\*\/$/, "")
                            .replace(/\* /g, "")
                            // Remove lines starting with @ (JSDoc tags)
                            .split("\n")
                            .map((l) => l.trim())
                            .filter((l) => l && !l.startsWith("@") && l !== "*")
                            .join(" ");

                        if (cleanDescription) {
                            meta.descriptions[functionName] = cleanDescription;
                        }
                    }
                }
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

function debounce(func: Function, wait: number) {
    let timeout: Timer;

    return function (...args: any[]) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
