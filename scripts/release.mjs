// リリース用バージョンbump。package.json / tauri.conf.json / Cargo.toml / Cargo.lock を
// 一括更新してコミットし、annotatedタグ vX.Y.Z を打つ。
// 使い方: npm run release patch   (patch | minor | major | 1.2.3)
// あとは: git push origin main --follow-tags
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const arg = process.argv[2] ?? "";
if (!["patch", "minor", "major"].includes(arg) && !/^\d+\.\d+\.\d+$/.test(arg)) {
  console.error("usage: npm run release <patch|minor|major|x.y.z>");
  process.exit(1);
}

if (execSync("git status --porcelain").toString().trim()) {
  console.error("working tree が汚れてる。先にコミットかstashして");
  process.exit(1);
}

const current = JSON.parse(readFileSync("package.json", "utf8")).version;
let version = arg;
if (!/^\d/.test(arg)) {
  let [major, minor, patch] = current.split(".").map(Number);
  if (arg === "major") [major, minor, patch] = [major + 1, 0, 0];
  if (arg === "minor") [minor, patch] = [minor + 1, 0];
  if (arg === "patch") patch += 1;
  version = `${major}.${minor}.${patch}`;
}

const replaceVersion = (path, pattern) => {
  const updated = readFileSync(path, "utf8").replace(pattern, `$1"${version}"`);
  writeFileSync(path, updated);
};
replaceVersion("package.json", /^(\s*"version": )".*"/m);
replaceVersion("src-tauri/tauri.conf.json", /^(\s*"version": )".*"/m);
replaceVersion("src-tauri/Cargo.toml", /^(version = )".*"/m);
execSync("cargo update -p relaydeck", { cwd: "src-tauri", stdio: "inherit" });

execSync(
  "git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock",
);
execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: "inherit" });
execSync(`git tag -a v${version} -m "v${version}"`, { stdio: "inherit" });

console.log(`\n${current} から ${version} にbumpしてタグ v${version} を打った`);
console.log("次: git push origin main --follow-tags");
