export default function namedFunc(
    _: string,
    flags: {
        /**
         * A test flag
         */
        foo?: string;
    },
) {
    console.log("namedDefault executed", flags);
}
