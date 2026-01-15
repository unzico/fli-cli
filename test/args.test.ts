import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "fixtures/args");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "args-cli");

describe("argument parsing", () => {
    beforeAll(async () => {
        // Clean previous build if any
        if (existsSync(TEST_CLI_BIN)) {
            unlinkSync(TEST_CLI_BIN);
        }

        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "build", "--baseDir", "src", "--name", "args-cli"], {
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

    it("should parse number argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-num", "123"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("number\n");
    });

    it("should parse boolean argument (true)", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-bool", "true"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("boolean\n");
    });

    it("should parse boolean argument (false)", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-bool", "false"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("boolean\n");
    });

    it("should parse string argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-string", "hello"], { stdio: ["ignore", "pipe", "inherit"] });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("string\n");
    });

    it("should parse string array argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-string-array", "one", "two", "three"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("string string string\n");
    });

    it("should parse number array argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-number-array", "1", "2", "3"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("number number number\n");
    });

    it("should parse boolean array argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-boolean-array", "true", "false", "true"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output).toBe("boolean boolean boolean\n");
    });

    it("should parse tuple argument", async () => {
        const proc = Bun.spawn([TEST_CLI_BIN, "test-tuple", "hello", "123", "true"], {
            stdio: ["ignore", "pipe", "inherit"],
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        expect(proc.exitCode).toBe(0);
        expect(output.trim()).toBe("string number boolean");
    });
});
