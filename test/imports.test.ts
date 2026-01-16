import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");

describe("imports", () => {
    describe("npm libraries", () => {
        const FIXTURE_DIR = join(import.meta.dir, "fixtures/imports/npm-picocolors");
        const TEST_CLI_BIN = join(FIXTURE_DIR, "test-picocolors-cli");

        afterAll(() => {
            if (existsSync(TEST_CLI_BIN)) unlinkSync(TEST_CLI_BIN);
        });

        it("should bundle external npm libraries (picocolors)", async () => {
            // install dependencies in the fixture
            Bun.spawnSync(["bun", "install"], { cwd: FIXTURE_DIR });

            const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "fli.entry.ts"], {
                cwd: FIXTURE_DIR,
                stdio: ["ignore", "inherit", "inherit"],
            });
            await proc.exited;
            expect(proc.exitCode).toBe(0);
            expect(existsSync(TEST_CLI_BIN)).toBe(true);

            const binProc = Bun.spawn([TEST_CLI_BIN], {
                cwd: FIXTURE_DIR,
                stdio: ["ignore", "pipe", "inherit"],
            });
            const output = await new Response(binProc.stdout).text();
            await binProc.exited;

            expect(binProc.exitCode).toBe(0);
            // more difficult to test the coloring, but it should at least run and print text
            expect(output).toContain("Hello, colorful world!");
        });
    });

    describe("external code", () => {
        const FIXTURE_DIR = join(import.meta.dir, "fixtures/imports/external-code/cli");
        const TEST_CLI_BIN = join(FIXTURE_DIR, "test-external-cli");

        afterAll(() => {
            if (existsSync(TEST_CLI_BIN)) unlinkSync(TEST_CLI_BIN);
        });

        it("should bundle code imported from outside base directory", async () => {
            const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "fli.entry.ts"], {
                cwd: FIXTURE_DIR,
                stdio: ["ignore", "inherit", "inherit"],
            });
            await proc.exited;
            expect(proc.exitCode).toBe(0);
            expect(existsSync(TEST_CLI_BIN)).toBe(true);

            const binProc = Bun.spawn([TEST_CLI_BIN], {
                cwd: FIXTURE_DIR,
                stdio: ["ignore", "pipe", "inherit"],
            });
            const output = await new Response(binProc.stdout).text();
            await binProc.exited;

            expect(binProc.exitCode).toBe(0);
            expect(output.trim()).toBe("HELLO FROM OUTSIDE");
        });
    });
});
