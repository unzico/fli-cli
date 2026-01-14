/**
 * This is the root command description.
 * It should be multi-line.
 * @param args Some arguments
 */
export function insertUser([email, password]: [string, string]) {
    console.log("Seeding user...");
    console.log("  Email:", email);
    console.log("  Password:", password);
}
