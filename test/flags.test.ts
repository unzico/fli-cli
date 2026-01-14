import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "fixtures/flags");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "flags-cli");

describe("flag extraction", () => {
    beforeAll(async () => {
        // Clean previous build if any
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }

        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "--baseDir", "src", "--name", "flags-cli"], {
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

    it("should extract flags from named default exported function", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "named-default", "--help"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toContain("--foo <value>");
        expect(output).toContain("A test flag");
    });

    it("should extract flags from unnamed default exported function", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "unnamed-default", "--help"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toContain("--bar <value>");
        expect(output).toContain("Another test flag");
    });
});
