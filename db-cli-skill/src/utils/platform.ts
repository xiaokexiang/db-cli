import os from "node:os";

/**
 * Platform information structure
 */
export interface PlatformInfo {
  os: string;
  arch: string;
  ext: string;
}

/**
 * Get platform suffix for GitHub Release asset naming
 *
 * Returns the suffix used in release asset filenames:
 * - windows/amd64: '-windows-amd64.exe'
 * - windows/arm64: '-windows-arm64.exe'
 * - darwin/amd64: '-darwin-amd64'
 * - darwin/arm64: '-darwin-arm64'
 * - linux/amd64: '-linux-amd64'
 * - linux/arm64: '-linux-arm64'
 *
 * @returns Platform suffix string
 * @throws Error if platform/architecture combination is not supported
 */
export function getPlatformSuffix(): string {
  const platform = os.platform();
  const arch = os.arch();

  const osName = platform === "win32" ? "windows" : platform === "darwin" ? "darwin" : "linux";
  const archName = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : null;

  if (!archName) {
    throw new Error(`Unsupported architecture: ${arch} on ${osName}`);
  }

  const ext = platform === "win32" ? ".exe" : "";
  return `-${osName}-${archName}${ext}`;
}

/**
 * Get detailed platform information
 *
 * @returns PlatformInfo object with os, arch, and ext
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  const arch = os.arch();

  const osName = platform === "win32" ? "windows" : platform === "darwin" ? "darwin" : "linux";
  const archName = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : arch;

  const ext = platform === "win32" ? ".exe" : "";

  return {
    os: osName,
    arch: archName,
    ext,
  };
}

/**
 * Validate if the current platform is supported
 *
 * Supported platforms:
 * - windows/amd64, windows/arm64
 * - darwin/amd64, darwin/arm64
 * - linux/amd64, linux/arm64
 *
 * @returns true if platform is supported, false otherwise
 */
export function isPlatformSupported(): boolean {
  try {
    getPlatformSuffix();
    return true;
  } catch {
    return false;
  }
}
