#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const WORKSPACE_ROOTS = ["apps", "packages"];
const GLOBAL_VERIFY_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".oxlintrc.json",
  ".prettierrc",
]);
const GLOBAL_VERIFY_PREFIXES = ["config/", ".husky/"];
const DRY_RUN = process.argv.includes("--dry-run");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit",
  });

  if (typeof result.status !== "number") {
    const errorMessage = result.error instanceof Error ? result.error.message : "Unknown error";
    throw new Error(`Failed to run ${command}: ${errorMessage}`);
  }

  return result;
}

function getStagedFiles() {
  const result = run("git", ["diff", "--cached", "--name-only", "--relative"], {
    captureOutput: true,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(stderr || "Unable to read staged files from git.");
  }

  return (result.stdout || "")
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => file.replaceAll(path.sep, "/"));
}

function isGlobalVerifyChange(file) {
  if (GLOBAL_VERIFY_FILES.has(file)) {
    return true;
  }

  if (GLOBAL_VERIFY_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }

  if (!file.includes("/") && /^tsconfig(\..+)?\.json$/.test(file)) {
    return true;
  }

  return false;
}

function discoverWorkspacePackages(rootDir) {
  const workspaces = [];

  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const absoluteWorkspaceRoot = path.join(rootDir, workspaceRoot);
    if (!existsSync(absoluteWorkspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relativeDir = `${workspaceRoot}/${entry.name}`;
      const packageJsonPath = path.join(rootDir, relativeDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJsonRaw = readFileSync(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonRaw);
      if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
        continue;
      }

      workspaces.push({
        name: packageJson.name,
        relativeDir,
      });
    }
  }

  return workspaces.toSorted((left, right) => right.relativeDir.length - left.relativeDir.length);
}

function getChangedWorkspaces(stagedFiles, workspaces) {
  const changedWorkspaceNames = new Set();

  for (const file of stagedFiles) {
    for (const workspace of workspaces) {
      if (file === workspace.relativeDir || file.startsWith(`${workspace.relativeDir}/`)) {
        changedWorkspaceNames.add(workspace.name);
        break;
      }
    }
  }

  return [...changedWorkspaceNames].toSorted();
}

function runVerifyChanged() {
  const rootDir = process.cwd();
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log("No staged files. Skipping verification.");
    return 0;
  }

  if (stagedFiles.some(isGlobalVerifyChange)) {
    const fullVerifyArgs = ["run", "verify"];
    console.log("Global config/root changes detected. Running full verification:", `pnpm ${fullVerifyArgs.join(" ")}`);
    if (DRY_RUN) {
      return 0;
    }

    return run("pnpm", fullVerifyArgs).status;
  }

  const workspaces = discoverWorkspacePackages(rootDir);
  const changedWorkspaces = getChangedWorkspaces(stagedFiles, workspaces);

  if (changedWorkspaces.length === 0) {
    console.log("No staged changes in apps/ or packages/. Skipping workspace verification.");
    return 0;
  }

  const turboArgs = [
    "turbo",
    "run",
    "lint",
    "check:types",
    "--parallel",
    ...changedWorkspaces.flatMap((workspaceName) => [`--filter=${workspaceName}`]),
  ];

  console.log("Running verification for changed workspaces:", changedWorkspaces.join(", "));
  console.log(`pnpm ${turboArgs.join(" ")}`);

  if (DRY_RUN) {
    return 0;
  }

  return run("pnpm", turboArgs).status;
}

try {
  const exitCode = runVerifyChanged();
  process.exit(exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(message);
  process.exit(1);
}
