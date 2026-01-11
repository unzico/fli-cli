# fli-cli (BETA)

> Build your own CLI in minutes using only files.

`fli-cli` turns your TypeScript file structure into a fully functional CLI.\
Stop writing boilerplate configuration and focus on your logic.

> fli-cli is currently in BETA. Please report any issues you may encounter.

## Requirements

This library requires [Bun](https://bun.sh) to work.

## Features

- 📂 **File-system Routing**: Your folder structure IS your command structure.
- 🎩 **Type-Safe Options**: Define options as TypeScript types—flags are generated automatically.
- 📝 **Self-Documentation**: JSDoc comments become CLI help text.
- ⚡ **Zero Config**: Just export a function.

## Usage

### 1. Structure maps to Commands

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

### 2. Arguments & Options

Simply export a function. The first argument receives command-line arguments, and the second argument defines your options.

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
export default function (args: string[], options: GreetOptions) {
    const message = args[0] || "Hello";
    const name = options.name || "stranger";

    if (options.loud) {
        console.log(`${message.toUpperCase()} ${name.toUpperCase()}!`);
    } else {
        console.log(`${message} ${name}.`);
    }
}
```

`fli-cli` automatically generates the help menu from your types and comments:

```bash
$ mycli greet --help
Usage: mycli greet [options] [args...]

Options:
  --loud            Shout the greeting
  --name <value>    Name to greet
  -h, --help        display help for command
```

## Installation

```bash
bun add fli-cli
```
