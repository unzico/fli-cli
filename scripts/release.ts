import path from "path";

const releaseType = process.argv[2];

if (typeof releaseType !== "string" || !["patch", "minor", "major"].includes(releaseType)) {
    console.error("Please provide a valid release type: patch, minor, or major");
    process.exit(1);
}

// 1. Bump version in package.json
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = Bun.file(packageJsonPath);
const packageJson = await packageJsonFile.json();
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split(".").map(Number);

let newVersion = "";
if (releaseType === "patch") newVersion = `${major}.${minor}.${patch + 1}`;
if (releaseType === "minor") newVersion = `${major}.${minor + 1}.0`;
if (releaseType === "major") newVersion = `${major + 1}.0.0`;

packageJson.version = newVersion;
await Bun.write(packageJsonPath, JSON.stringify(packageJson, null, 4) + "\n");
console.log(`Bumped version from ${currentVersion} to ${newVersion}`);

// 2. Update CHANGELOG.md
const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");
const changelogFile = Bun.file(changelogPath);
let changelog = await changelogFile.text();
const date = new Date().toISOString().split("T")[0];

const unreleasedHeader = "## [Unreleased]";
const newEntry = `## [Unreleased]\n\n## [${newVersion}] - ${date}`;

if (changelog.includes(unreleasedHeader)) {
    changelog = changelog.replace(unreleasedHeader, newEntry);
    await Bun.write(changelogPath, changelog);
    console.log("Updated CHANGELOG.md");
} else {
    console.warn("Could not find [Unreleased] section in CHANGELOG.md, skipping update.");
}

// 3. Git commit and tag
const run = (cmd: string[]) => {
    console.log(`Running: ${cmd.join(" ")}`);
    const result = Bun.spawnSync(cmd, { stdio: ["inherit", "inherit", "inherit"] });
    if (result.exitCode !== 0) {
        console.error(`Command failed: ${cmd.join(" ")}`);
        process.exit(1);
    }
};

run(["git", "add", "package.json", "CHANGELOG.md"]);
run(["git", "commit", "-m", `chore(release): v${newVersion}`]);
run(["git", "tag", `v${newVersion}`]);
run(["git", "push"]);
run(["git", "push", "origin", `v${newVersion}`]);

console.log(`Release v${newVersion} completed!`);
