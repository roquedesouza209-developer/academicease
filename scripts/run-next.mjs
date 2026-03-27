import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const nextWasmDir = path.join(projectRoot, "node_modules", "@next", "swc-wasm-nodejs");

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("AcademicEase expected a Next.js command such as dev, build, or start.");
  process.exit(1);
}

if (!existsSync(nextCli)) {
  console.error("AcademicEase could not find Next.js. Run npm install and try again.");
  process.exit(1);
}

if (!existsSync(nextWasmDir)) {
  console.error("AcademicEase could not find @next/swc-wasm-nodejs. Run npm install and try again.");
  process.exit(1);
}

process.env.NEXT_TEST_WASM = process.env.NEXT_TEST_WASM || "1";
process.env.NEXT_TEST_WASM_DIR = process.env.NEXT_TEST_WASM_DIR || nextWasmDir;

const commandArgs = [command, ...args];
const needsWebpack = command === "dev" || command === "build";
const alreadySelectedBundler = args.includes("--webpack") || args.includes("--turbopack");

if (needsWebpack && !alreadySelectedBundler) {
  commandArgs.splice(1, 0, "--webpack");
}

const child = spawn(process.execPath, [nextCli, ...commandArgs], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
