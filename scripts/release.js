import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const RELEASES_DIR = join(ROOT, "releases");
const RELEASE_VERSION_FILE = join(ROOT, ".release-version");
const MODE = process.argv[2] === "update" ? "update" : "release";

function normalizeVersion(version) {
  const trimmed = version.trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+$/.test(trimmed) ? trimmed : null;
}

function getRequestedVersion() {
  return normalizeVersion(process.env.RELEASE_VERSION ?? "");
}

function getCurrentVersion() {
  if (existsSync(RELEASE_VERSION_FILE)) {
    return readFileSync(RELEASE_VERSION_FILE, "utf8").trim();
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return pkg.version || "1.0.0";
}

function bumpPatch(version) {
  const parts = version.split(".").map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return "1.0.0";
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function updateVersionInFiles(version) {
  const pkgPath = join(ROOT, "package.json");
  const manifestPath = join(ROOT, "public", "manifest.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

function buildReleaseDir(version) {
  if (!existsSync(RELEASES_DIR)) mkdirSync(RELEASES_DIR, { recursive: true });
  const releaseDir = join(RELEASES_DIR, version);
  mkdirSync(releaseDir, { recursive: true });
  cpSync(join(DIST, "index.html"), join(releaseDir, "index.html"));
  cpSync(join(DIST, "manifest.json"), join(releaseDir, "manifest.json"));
  cpSync(join(DIST, "assets"), join(releaseDir, "assets"), { recursive: true });
  if (existsSync(join(DIST, "background.js"))) {
    cpSync(join(DIST, "background.js"), join(releaseDir, "background.js"));
  }
  if (existsSync(join(DIST, "shelf-llm-overlay.js"))) {
    cpSync(join(DIST, "shelf-llm-overlay.js"), join(releaseDir, "shelf-llm-overlay.js"));
  }
  if (existsSync(join(DIST, "obsidian-setup.html"))) {
    cpSync(join(DIST, "obsidian-setup.html"), join(releaseDir, "obsidian-setup.html"));
  }
  return releaseDir;
}

function createArchives(releaseDir, version) {
  const tarPath = join(RELEASES_DIR, `${version}.tar.gz`);
  const zipPath = join(RELEASES_DIR, `${version}.zip`);
  execSync(`tar -czf "${tarPath}" -C "${RELEASES_DIR}" "${version}"`, { stdio: "inherit" });
  execSync(`zip -r "${zipPath}" "${version}"`, { cwd: RELEASES_DIR, stdio: "inherit" });
  console.log(`Created ${relative(ROOT, tarPath)}`);
  console.log(`Created ${relative(ROOT, zipPath)}`);
}

function main() {
  const currentVersion = getCurrentVersion();
  const requestedVersion = getRequestedVersion();
  const version = requestedVersion ?? (MODE === "release" ? bumpPatch(currentVersion) : currentVersion);
  updateVersionInFiles(version);
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  const releaseDir = buildReleaseDir(version);
  createArchives(releaseDir, version);
  writeFileSync(RELEASE_VERSION_FILE, version + "\n");
  console.log(`Done. Release output: ${releaseDir.replace(ROOT + "/", "")}/`);
}

main();
