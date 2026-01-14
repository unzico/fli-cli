import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "fixtures/description");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "desc-cli");

describe("command descriptions", () => {
    afterAll(() => {
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }
    });

    it("should include descriptions from JSDoc comments", async () => {
        const buildProc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "--baseDir", ".", "--name", "desc-cli"], {
            cwd: FIXTURE_DIR,
            stdio: ["ignore", "inherit", "inherit"],
        });

        await buildProc.exited;

        expect(buildProc.exitCode).toBe(0);
        expect(existsSync(TEST_CLI_BIN)).toBe(true);

        const helpProc = Bun.spawn([TEST_CLI_BIN, "--help"], {
            stdio: ["ignore", "pipe", "ignore"],
        });

        const helpOutput = await new Response(helpProc.stdout).text();
        await helpProc.exited;

        expect(helpOutput).toContain("This is the root command description.");
        expect(helpOutput).toContain("It should be multi-line.");
        expect(helpOutput).not.toContain("@param");

        expect(helpOutput).toContain("sub");
        expect(helpOutput).toContain("This is a sub command description.");
    });
});
