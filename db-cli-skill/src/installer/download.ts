import { Octokit } from "@octokit/rest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { getPlatformSuffix } from "../utils/platform.js";

/**
 * Download result containing path to downloaded file
 */
export interface DownloadResult {
  /** Path to downloaded binary */
  path: string;
  /** Release version/tag */
  version: string;
  /** Asset name */
  assetName: string;
}

/**
 * Download the latest db-cli release from GitHub Releases
 *
 * @param options - Optional configuration
 * @param options.owner - GitHub repository owner (default: xiaokexiang)
 * @param options.repo - GitHub repository name (default: database-cli)
 * @param options.token - GitHub PAT for auth (optional, uses GITHUB_TOKEN env)
 * @returns DownloadResult with path to downloaded binary
 * @throws Error if no release found, no matching asset, or download fails
 */
export async function downloadLatestRelease(
  options: {
    owner?: string;
    repo?: string;
    token?: string;
  } = {}
): Promise<DownloadResult> {
  const {
    owner = "xiaokexiang",
    repo = "database-cli",
    token = process.env.GITHUB_TOKEN,
  } = options;

  // Create Octokit instance with optional auth
  const octokit = new Octokit(token ? { auth: token } : {});

  try {
    // Fetch latest release
    const { data: release } = await octokit.repos.getLatestRelease({
      owner,
      repo,
    });

    if (!release || !release.tag_name) {
      throw new Error("No release found");
    }

    // Get platform suffix
    const platformSuffix = getPlatformSuffix();

    // Find matching asset
    const asset = release.assets.find((a) => a.name.endsWith(platformSuffix));

    if (!asset) {
      const availableAssets = release.assets.map((a) => a.name).join(", ");
      throw new Error(
        `No binary for platform: ${platformSuffix}. Available assets: ${availableAssets}`
      );
    }

    // Download binary
    const downloadUrl = asset.browser_download_url;
    const tempDir = os.tmpdir();
    const assetName = asset.name;
    const downloadPath = path.join(tempDir, `db-cli-${Date.now()}${platformSuffix}`);

    console.log(`Downloading ${assetName} from ${downloadUrl}...`);

    // Use fetch (built-in in Node 18+) to download
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write to temp location
    fs.writeFileSync(downloadPath, buffer);

    console.log(`Downloaded to ${downloadPath}`);

    return {
      path: downloadPath,
      version: release.tag_name,
      assetName,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Download failed: ${error.message}`);
    }
    throw new Error(`Download failed: ${String(error)}`);
  }
}

/**
 * Download a specific release version by tag name
 *
 * @param tag - Release tag to download (e.g., "v1.0.0")
 * @param options - Optional configuration
 * @returns DownloadResult with path to downloaded binary
 */
export async function downloadReleaseByTag(
  tag: string,
  options: {
    owner?: string;
    repo?: string;
    token?: string;
  } = {}
): Promise<DownloadResult> {
  const {
    owner = "xiaokexiang",
    repo = "database-cli",
    token = process.env.GITHUB_TOKEN,
  } = options;

  const octokit = new Octokit(token ? { auth: token } : {});

  try {
    // Fetch specific release by tag
    const { data: release } = await octokit.repos.getReleaseByTag({
      owner,
      repo,
      tag,
    });

    // Rest of the logic is the same as downloadLatestRelease
    const platformSuffix = getPlatformSuffix();
    const asset = release.assets.find((a) => a.name.endsWith(platformSuffix));

    if (!asset) {
      throw new Error(
        `No binary for platform: ${platformSuffix} in release ${tag}`
      );
    }

    const downloadUrl = asset.browser_download_url;
    const tempDir = os.tmpdir();
    const downloadPath = path.join(tempDir, `db-cli-${Date.now()}${platformSuffix}`);

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(downloadPath, Buffer.from(arrayBuffer));

    return {
      path: downloadPath,
      version: tag,
      assetName: asset.name,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Download failed: ${error.message}`);
    }
    throw new Error(`Download failed: ${String(error)}`);
  }
}
