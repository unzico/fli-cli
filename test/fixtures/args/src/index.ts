export function testNum(n: number) {
    console.log(typeof n);
}

export function testBool(b: boolean) {
    console.log(typeof b);
}

export function testString(s: string) {
    console.log(typeof s);
}

export function testStringArray(args: string[]) {
    console.log(args.map((a) => typeof a).join(" "));
}

export function testNumberArray(args: number[]) {
    console.log(args.map((a) => typeof a).join(" "));
}

export function testBooleanArray(args: boolean[]) {
    console.log(args.map((a) => typeof a).join(" "));
}

export function testTuple(args: [string, number, boolean]) {
    console.log(args.map((a) => typeof a).join(" "));
}
