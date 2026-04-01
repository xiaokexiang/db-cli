import * as fs from "node:fs";
import * as path from "node:path";
import { getBinaryPath, ensureBinaryDirectory } from "../utils/binary-path.js";
import { downloadLatestRelease, downloadReleaseByTag } from "./download.js";

/**
 * Installation result
 */
export interface InstallResult {
  /** Path where binary was installed */
  installedPath: string;
  /** Version installed */
  version: string;
  /** Whether this was a fresh install or overwrite */
  freshInstall: boolean;
}

/**
 * Install the db-cli binary from GitHub Releases
 *
 * @param options - Installation options
 * @param options.force - Overwrite existing binary without prompt
 * @param options.version - Specific version to install (default: latest)
 * @returns InstallResult with installation details
 */
export async function installSkill(
  options: {
    force?: boolean;
    version?: string;
  } = {}
): Promise<InstallResult> {
  const { force = false, version } = options;

  const expectedPath = getBinaryPath();
  const parentDir = ensureBinaryDirectory();

  // Check if binary already exists
  let freshInstall = true;
  if (fs.existsSync(expectedPath)) {
    if (!force) {
      throw new Error(
        `Binary already exists at ${expectedPath}. Use --force to overwrite.`
      );
    }
    freshInstall = false;
    console.log(`Overwriting existing binary at ${expectedPath}...`);
  }

  // Download the release
  let downloadResult;
  if (version) {
    downloadResult = await downloadReleaseByTag(version);
  } else {
    downloadResult = await downloadLatestRelease();
  }

  try {
    // Copy binary to expected location
    console.log(`Installing to ${expectedPath}...`);

    // Ensure parent directory exists
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Copy file
    fs.copyFileSync(downloadResult.path, expectedPath);

    // Set executable permissions on Unix
    if (process.platform !== "win32") {
      fs.chmodSync(expectedPath, 0o755);
      console.log(`Set executable permissions on ${expectedPath}`);
    }

    console.log(`Successfully installed db-cli ${downloadResult.version}`);

    return {
      installedPath: expectedPath,
      version: downloadResult.version,
      freshInstall,
    };
  } catch (error) {
    // Cleanup on failure - remove partial install
    if (fs.existsSync(expectedPath)) {
      fs.unlinkSync(expectedPath);
    }
    throw new Error(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify that the db-cli binary is installed and executable
 *
 * @returns true if binary exists and is executable, false otherwise
 */
export async function verifyInstallation(): Promise<boolean> {
  const binaryPath = getBinaryPath();

  try {
    // Check if file exists
    if (!fs.existsSync(binaryPath)) {
      console.log(`Binary not found at ${binaryPath}`);
      return false;
    }

    // Check if executable (Unix) or just exists (Windows)
    if (process.platform !== "win32") {
      try {
        fs.accessSync(binaryPath, fs.constants.X_OK);
        console.log(`Binary is executable at ${binaryPath}`);
        return true;
      } catch {
        console.log(`Binary exists but is not executable at ${binaryPath}`);
        return false;
      }
    }

    console.log(`Binary found at ${binaryPath}`);
    return true;
  } catch (error) {
    console.log(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Uninstall the db-cli binary
 *
 * @returns true if successfully uninstalled, false if binary was not found
 */
export async function uninstallSkill(): Promise<boolean> {
  const binaryPath = getBinaryPath();

  if (!fs.existsSync(binaryPath)) {
    console.log(`Binary not found at ${binaryPath}, nothing to uninstall`);
    return false;
  }

  try {
    fs.unlinkSync(binaryPath);
    console.log(`Uninstalled db-cli from ${binaryPath}`);

    // Try to remove empty parent directories
    const parentDir = path.dirname(binaryPath);
    try {
      fs.rmdirSync(parentDir);
      console.log(`Removed empty directory ${parentDir}`);

      // Try to remove grandparent (~/.db-cli)
      const grandparentDir = path.dirname(parentDir);
      fs.rmdirSync(grandparentDir);
      console.log(`Removed empty directory ${grandparentDir}`);
    } catch {
      // Directories not empty, that's fine
    }

    return true;
  } catch (error) {
    throw new Error(`Uninstall failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a newer version is available
 *
 * @returns Object with current version info and update availability
 */
export async function checkForUpdates(): Promise<{
  currentVersion: string | null;
  latestVersion: string;
  updateAvailable: boolean;
}> {
  const binaryPath = getBinaryPath();

  // Get current version (from file metadata or null if not installed)
  let currentVersion: string | null = null;
  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    currentVersion = stats.mtime.toISOString();
  }

  // Get latest release version
  const { Octokit } = await import("@octokit/rest");
  const octokit = new Octokit(
    process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {}
  );

  const { data: release } = await octokit.repos.getLatestRelease({
    owner: "xiaokexiang",
    repo: "database-cli",
  });

  const latestVersion = release.tag_name;

  // Compare versions (simple string comparison for semver)
  const updateAvailable = currentVersion === null || currentVersion !== latestVersion;

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
  };
}
