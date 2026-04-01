import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Get the platform-specific expected path for the db-cli binary
 *
 * @returns The expected path to the db-cli binary
 */
export function getBinaryPath(): string {
  const homeDir = os.homedir();

  // Platform-specific binary paths
  if (process.platform === "win32") {
    // Windows: %APPDATA%\.db-cli\bin\db-cli.exe
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    return path.join(appData, ".db-cli", "bin", "db-cli.exe");
  } else {
    // macOS/Linux: ~/.db-cli/bin/db-cli
    return path.join(homeDir, ".db-cli", "bin", "db-cli");
  }
}

/**
 * Check if the db-cli binary exists at the expected location
 *
 * @returns true if binary exists and is executable, false otherwise
 */
export function ensureBinaryExists(): boolean {
  const binaryPath = getBinaryPath();

  try {
    // Check if file exists
    if (!fs.existsSync(binaryPath)) {
      return false;
    }

    // Check if executable (Unix) or just exists (Windows)
    if (process.platform !== "win32") {
      try {
        fs.accessSync(binaryPath, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the directory for the db-cli binary exists
 * Creates the directory if it doesn't exist
 *
 * @returns The directory path
 */
export function ensureBinaryDirectory(): string {
  const binaryPath = getBinaryPath();
  const dir = path.dirname(binaryPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}
