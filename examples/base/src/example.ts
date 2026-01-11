export function singleArgument(arg: string) {
    console.log("This command only takes a single argument:", arg);
}

export function multipleArguments(args: string[]) {
    console.log("This command takes multiple arguments:", args);
}

export function testNum(n: number) {
    console.log("Number argument:", n, "Type:", typeof n);
}

export function testBool(b: boolean) {
    console.log("Boolean argument:", b, "Type:", typeof b);
}

export function testString(s: string) {
    console.log("String argument:", s, "Type:", typeof s);
}

export function testOpt(s?: string) {
    console.log("Optional argument:", s, "Type:", typeof s);
}

export function flags(
    _args: string[],
    flags: {
        /** Output as JSON */
        json: boolean;
        /** Some random flag */
        random?: boolean;
        /** A number */
        num?: number;
        /** A string */
        str?: string;
    },
) {
    console.log("This command accepts arguments and flags:", flags);
}
