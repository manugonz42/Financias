#!/usr/bin/env node
// Sube la versión de la app de forma consistente y prepara la release.
//   npm run release 0.2.0            → bumpea, commitea y crea el tag v0.2.0 (no hace push)
//   npm run release 0.2.0 -- --push  → además sube commit y tag (dispara el CI)
//
// Mantiene la MISMA versión en package.json, tauri.conf.json, Cargo.toml y Cargo.lock,
// que es lo que necesita el auto-updater para detectar correctamente la versión nueva.

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const version = process.argv[2];
const push = process.argv.includes("--push");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Uso: npm run release <X.Y.Z> [-- --push]\nEjemplo: npm run release 0.2.0");
  process.exit(1);
}
const tag = `v${version}`;

// 1) package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

// 2) src-tauri/tauri.conf.json
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
conf.version = version;
writeFileSync("src-tauri/tauri.conf.json", JSON.stringify(conf, null, 2) + "\n");

// 3) src-tauri/Cargo.toml  (primer `version = "..."` a inicio de línea = [package])
const cargoPath = "src-tauri/Cargo.toml";
const cargo = readFileSync(cargoPath, "utf8");
if (!/^version = ".*"$/m.test(cargo)) {
  console.error("No se encontró la versión en Cargo.toml ([package].version).");
  process.exit(1);
}
writeFileSync(cargoPath, cargo.replace(/^version = ".*"$/m, `version = "${version}"`));

// 4) src-tauri/Cargo.lock  (entrada del propio paquete, para no dejarla desfasada)
const lockPath = "src-tauri/Cargo.lock";
const lock = readFileSync(lockPath, "utf8");
writeFileSync(lockPath, lock.replace(/(name = "financias"\nversion = ").*(")/, `$1${version}$2`));

console.log(`Versión → ${version} (package.json, tauri.conf.json, Cargo.toml, Cargo.lock).`);

const git = (cmd) => execSync(`git ${cmd}`, { stdio: "inherit" });
git("add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock");
git(`commit -m "release: ${tag}"`);
git(`tag ${tag}`);
console.log(`Commit y tag ${tag} creados.`);

if (push) {
  git("push");
  git(`push origin ${tag}`);
  console.log("Subidos. GitHub Actions generará los instaladores y la Release.");
} else {
  console.log(`\nPara publicar:\n  git push\n  git push origin ${tag}\n(o repite con: npm run release ${version} -- --push)`);
}
