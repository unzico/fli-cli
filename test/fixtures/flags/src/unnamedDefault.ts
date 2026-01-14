export default function (
    _: string,
    flags: {
        /**
         * Another test flag
         */
        bar?: number;
    },
) {
    console.log("unnamedDefault executed", flags);
}
