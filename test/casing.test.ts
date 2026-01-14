import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "fixtures/casing");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "casing-cli");

describe("casing transformation", () => {
    beforeAll(async () => {
        // Clean previous build if any
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }

        // Build with baseDir set to "." since we are inside fixtures/casing which IS the root
        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "--baseDir", ".", "--name", "casing-cli"], {
            cwd: FIXTURE_DIR,
            stdio: ["ignore", "inherit", "inherit"],
        });

        await proc.exited;

        if (proc.exitCode !== 0) {
            throw new Error("Build failed");
        }
    });

    afterAll(() => {
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }
    });

    it("should transform PascalCaseFile.ts to pascal-case-file command", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "pascal-case-file"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("PascalCaseFile");
    });

    it("should transform camelCaseFile.ts to camel-case-file command", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "camel-case-file"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("camelCaseFile");
    });

    it("should transform kebab-case-file.ts to kebab-case-file command", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "kebab-case-file"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("kebab-case-file");
    });

    it("should transform PascalCaseDir to pascal-case-dir and handle nested files", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "pascal-case-dir"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("PascalCaseDir root");

        const nestedProc = Bun.spawn([TEST_CLI_BIN, "pascal-case-dir", "pascal-case-nested"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const nestedOutput = await new Response(nestedProc.stdout).text();
        await nestedProc.exited;
        expect(nestedProc.exitCode).toBe(0);
        expect(nestedOutput.trim()).toBe("PascalCaseNested");
    });

    it("should transform camelCaseDir to camel-case-dir and handle nested files", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "camel-case-dir"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("camelCaseDir root");

        const nestedProc = Bun.spawn([TEST_CLI_BIN, "camel-case-dir", "camel-case-nested"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const nestedOutput = await new Response(nestedProc.stdout).text();
        await nestedProc.exited;
        expect(nestedProc.exitCode).toBe(0);
        expect(nestedOutput.trim()).toBe("camelCaseNested");
    });

    it("should transform kebab-case-dir to kebab-case-dir and handle nested files", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "kebab-case-dir"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("kebab-case-dir root");

        const nestedProc = Bun.spawn([TEST_CLI_BIN, "kebab-case-dir", "kebab-case-nested"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const nestedOutput = await new Response(nestedProc.stdout).text();
        await nestedProc.exited;
        expect(nestedProc.exitCode).toBe(0);
        expect(nestedOutput.trim()).toBe("kebab-case-nested");
    });

    it("should transform named exports (functions) to kebab-case commands", async () => {
        const proc1 = Bun.spawn([TEST_CLI_BIN, "mixed-exports", "pascal-func"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const out1 = await new Response(proc1.stdout).text();
        await proc1.exited;
        expect(proc1.exitCode).toBe(0);
        expect(out1.trim()).toBe("PascalFunc");

        const proc2 = Bun.spawn([TEST_CLI_BIN, "mixed-exports", "camel-func"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const out2 = await new Response(proc2.stdout).text();
        await proc2.exited;
        expect(proc2.exitCode).toBe(0);
        expect(out2.trim()).toBe("camelFunc");
    });
});
