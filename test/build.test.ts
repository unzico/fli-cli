import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "fixtures/base");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "test-cli");

describe("build command", () => {
    const ENTRY_FILE = "fli.entry.ts";

    beforeAll(async () => {
        const proc = Bun.spawn(["bun", "run", "build"], {
            cwd: import.meta.dir,
            stdio: ["ignore", "inherit", "inherit"],
        });

        await proc.exited;
    });
    afterAll(() => {
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }
    });

    it("should build a CLI using an entry file", async () => {
        // We run it with CWD set to the fixture dir so strictly relative paths in entry file work as expected
        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", ENTRY_FILE], {
            cwd: FIXTURE_DIR,
            stdio: ["ignore", "inherit", "inherit"],
        });

        await proc.exited;

        expect(proc.exitCode).toBe(0);
        expect(existsSync(TEST_CLI_BIN)).toBe(true);

        const binProc = Bun.spawn([TEST_CLI_BIN, "Universe"], {
            stdio: ["ignore", "pipe", "inherit"],
        });

        const output = await new Response(binProc.stdout).text();
        await binProc.exited;

        expect(binProc.exitCode).toBe(0);
        expect(output.trim()).toBe("Hello, Universe!");
    });

    it("should build a CLI using flags", async () => {
        // We run it with CWD set to the fixture dir so strictly relative paths in entry file work as expected
        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "--baseDir", ".", "--name", "test-cli"], {
            cwd: FIXTURE_DIR,
            stdio: ["ignore", "inherit", "inherit"],
        });

        await proc.exited;

        expect(proc.exitCode).toBe(0);
        expect(existsSync(TEST_CLI_BIN)).toBe(true);

        const binProc = Bun.spawn([TEST_CLI_BIN, "Universe"], {
            stdio: ["ignore", "pipe", "inherit"],
        });

        const output = await new Response(binProc.stdout).text();
        await binProc.exited;

        expect(binProc.exitCode).toBe(0);
        expect(output.trim()).toBe("Hello, Universe!");
    });

    it("should not accept both entry file and flags", async () => {
        // We run it with CWD set to the fixture dir so strictly relative paths in entry file work as expected
        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", ENTRY_FILE, "--baseDir", ".", "--name", "test-cli"], {
            cwd: FIXTURE_DIR,
            stdio: ["ignore", "ignore", "pipe"],
        });

        const output = await new Response(proc.stderr).text();
        await proc.exited;

        expect(proc.exitCode).toBe(1);
        expect(output.trim()).toBe(
            "Error: Cannot use flags (--baseDir, --name) when an entry file is provided.\nPlease either configure via the entry file OR use flags directly.",
        );
    });
});
