// package.json の version を正として、tauri.conf.json / Cargo.toml / Cargo.lock に同期する。
// npm version の "version" ライフサイクル（バージョン書き換え後・コミット前）から呼ばれる想定。
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = JSON.parse(readFileSync("package.json", "utf8")).version;

const confPath = "src-tauri/tauri.conf.json";
const conf = readFileSync(confPath, "utf8").replace(
  /^(\s*"version": )".*"/m,
  `$1"${version}"`,
);
writeFileSync(confPath, conf);

const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"$/m,
  `version = "${version}"`,
);
writeFileSync(cargoPath, cargo);

execSync("cargo update -p relaydeck", { cwd: "src-tauri", stdio: "inherit" });

console.log(`synced version ${version} to tauri.conf.json / Cargo.toml / Cargo.lock`);
