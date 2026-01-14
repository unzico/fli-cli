# fli-cli (BETA)

**Build your own CLI in minutes using only files.**

`fli-cli` turns your TypeScript file structure into a fully functional CLI.
Stop writing boilerplate configuration and focus on your logic.

> fli-cli is currently in BETA. Please report any issues you may encounter.

## Requirements

This library requires [Bun](https://bun.sh) to work.

## Features

- 📂 **File-system Routing**: Your folder structure IS your command structure.
- 🎩 **Type-Safe Options**: Define options as TypeScript types—flags are generated automatically.
- 🛡️ **Auto-Coercion**: Arguments are automatically cast to their declared TypeScript types (numbers, booleans).
- 📝 **Self-Documentation**: JSDoc comments automatically become CLI help text.
- ⏱️ **Watch Mode**: Instant feedback while you develop with `fli-cli watch`.
- ⚡ **Zero Config**: Just export a function.

## Get Started

In this guide, we'll build a simple CLI to manage users in a SQLite database.

### 1. Install

```bash
mkdir my-cli && cd my-cli
bun init -y
bun add fli-cli -D
bun add commander # fli-cli depends on commander
```

### 2. Create your command

`fli-cli` uses your file structure to create commands. Create a file at `src/create-user.ts`.
This will automatically become the `create-user` command.

`src/create-user.ts`:

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

// 1. Define your options as a Type
type UserOptions = {
    /**
     * User's age
     */
    age?: number;
    /**
     * Grant admin privileges
     */
    admin?: boolean;
};

/**
 * Create a new user in the database
 * @param name The username to create
 */
export default function main(name: string, options: UserOptions) {
    // 2. Write your logic
    db.query("CREATE TABLE IF NOT EXISTS users (name TEXT, age INTEGER, admin BOOLEAN)").run();

    db.query("INSERT INTO users (name, age, admin) VALUES ($name, $age, $admin)").run({
        $name: name,
        $age: options.age || 0,
        $admin: options.admin || false,
    });

    console.log(`Created user ${name}!`);
}
```

### 3. Build & Run

Run the build command to compile your CLI:

```bash
bunx fli-cli build
```

Now you can run your new CLI:

```bash
./cli create-user "Alice" --age 30 --admin
# Output: Created user Alice!
```

## Usage

### Structure maps to Commands

`fli-cli` intuitively maps your `src` directory to CLI commands.

- **Named Files** (`create.ts`) -> `mycli create`
- **Directories** (`db/`) -> `mycli db ...`
- **Index Files** (`db/index.ts`) -> `mycli db` (root command for the directory)

```text
src/
├── index.ts          # -> mycli
├── user.ts           # -> mycli user
└── db/
    ├── index.ts      # -> mycli db
    └── migrate.ts    # -> mycli db migrate
```

### Development: Watch Mode

You can use the watch command to automatically rebuild your CLI whenever you make changes:

```bash
bunx fli-cli watch "src/**/*.ts"
```

### Arguments & Options

Simply export a function. The first argument receives command-line arguments, and the second argument defines your options.

`fli-cli` is smart enough to coerce your arguments based on your TypeScript types.

`src/greet.ts`:

```typescript
type GreetOptions = {
    /**
     * Shout the greeting
     */
    loud?: boolean;

    /**
     * Name to greet
     */
    name?: string;
};

// > mycli greet hello --loud --name=World
export default function (greeting: string, options: GreetOptions) {
    const name = options.name || "stranger";

    if (options.loud) {
        console.log(`${greeting.toUpperCase()} ${name.toUpperCase()}!`);
    } else {
        console.log(`${greeting} ${name}.`);
    }
}
```

Start the `watch` mode and try it out:

```bash
$ ./cli greet hello --loud --name=World
HELLO WORLD!
```

### Generated Help Text

`fli-cli` automatically generates the help menu from your JSDoc comments:

```bash
$ ./cli greet --help
Usage: cli greet [options] <greeting>

Options:
  --loud            Shout the greeting
  --name <value>    Name to greet
  -h, --help        display help for command
```
