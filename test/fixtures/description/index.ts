/**
 * This is the root command description.
 * It should be multi-line.
 * @param args Some arguments
 */
export default function root(args: string[]) {
    console.log("root command");
}

/**
 * This is a sub command description.
 */
export function sub() {
    console.log("sub command");
}
