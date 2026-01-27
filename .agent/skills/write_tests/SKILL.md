---
name: write-tests
description: Guide for writing tests using Bun's test runner for the crew project, covering structure, naming, and execution patterns.
---

# Write Tests

This skill provides guidelines and patterns for writing tests in the `crew` project using the `bun:test` framework.

## Overview

The project uses [Bun's native test runner](https://bun.sh/docs/cli/test) for all testing. Tests are located in the `test/` directory.

## File Structure & Naming

- **Directory**: All tests reside in `test/`.
- **Extension**: Test files must end with `.test.ts`.
- **Naming**: Use descriptive names matching the feature being tested (e.g., `args.test.ts` for argument parsing).
- **Fixtures**: Use `test/fixtures/` for temporary files or test data. Subdirectories in fixtures should match the test file name (e.g., `test/fixtures/args` for `args.test.ts`).

## Fixture Isolation

Test fixtures must be self-contained and isolated from the main repository's dependencies.

- **Dependencies**: Do not import packages from the root `node_modules` that are not part of the project's runtime dependencies.
- **Local Packages**: If a test case requires a specific npm package (e.g. `picocolors`), create a `package.json` within the fixture directory and install it during the test setup.
- **Setup**: Use `Bun.spawnSync(["bun", "install"], { cwd: FIXTURE_DIR })` in your test to ensure dependencies are available.

## Core Testing Patterns

### 1. Imports

Standard imports for a test file:

```typescript
import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
```

### 2. Path Setup

Define constants for paths to ensure portability and clarity:

```typescript
const FIXTURE_DIR = join(import.meta.dir, "fixtures/my-feature");
const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");
const TEST_CLI_BIN = join(FIXTURE_DIR, "test-cli-bin");
```

### 3. CLI Execution (Integration Tests)

Use `Bun.spawn` to run the CLI command. This is the primary way to test the CLI end-to-end.

**Pattern:**

```typescript
const proc = Bun.spawn(["bun", FLI_CLI_PATH, "command", "arg1"], {
    cwd: FIXTURE_DIR, // Set working directory to fixture
    stdio: ["ignore", "pipe", "inherit"], // Capure stdout, inherit stderr for debugging
});
const output = await new Response(proc.stdout).text();
await proc.exited;

expect(proc.exitCode).toBe(0);
expect(output).toContain("expected output");
```

### 4. Setup and Teardown

Use `beforeAll` and `afterAll` to clean up artifacts like generated binaries.

**Pattern:**

```typescript
describe("my feature", () => {
    beforeAll(() => {
        if (existsSync(TEST_CLI_BIN)) unlinkSync(TEST_CLI_BIN);
    });

    afterAll(() => {
        if (existsSync(TEST_CLI_BIN)) unlinkSync(TEST_CLI_BIN);
    });

    // ... tests
});
```

## Example: Basic CLI Test

Here is a complete example of a minimal test file:

```typescript
import { describe, it, expect, afterAll } from "bun:test";
import { join } from "node:path";

const FLI_CLI_PATH = join(import.meta.dir, "../dist/cli.js");

describe("cli basic", () => {
    it("should print help", async () => {
        const proc = Bun.spawn(["bun", FLI_CLI_PATH, "--help"], {
            stdio: ["ignore", "pipe", "inherit"],
        });

        const output = await new Response(proc.stdout).text();
        await proc.exited;

        expect(proc.exitCode).toBe(0);
        expect(output).toContain("Usage:");
    });
});
```
