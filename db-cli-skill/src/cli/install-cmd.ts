#!/usr/bin/env node

import { installSkill, verifyInstallation, uninstallSkill, checkForUpdates } from "../installer/install.js";
import { ensureBinaryDirectory } from "../utils/binary-path.js";

/**
 * Parsed command line arguments
 */
interface ParsedArgs {
  force: boolean;
  version?: string;
  help: boolean;
  verify: boolean;
  uninstall: boolean;
  check: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    force: false,
    version: undefined,
    help: false,
    verify: false,
    uninstall: false,
    check: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--force":
      case "-f":
        result.force = true;
        break;
      case "--version":
      case "-v":
        result.version = args[++i];
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--verify":
        result.verify = true;
        break;
      case "--uninstall":
        result.uninstall = true;
        break;
      case "--check":
        result.check = true;
        break;
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
db-cli-skill installer

Usage: npx db-cli-skill install [options]

Options:
  -f, --force        Overwrite existing installation without prompt
  -v, --version X    Install specific version (default: latest)
  --verify           Verify current installation
  --check            Check for available updates
  --uninstall        Remove installed binary
  -h, --help         Show this help message

Examples:
  npx db-cli-skill install              Install latest version
  npx db-cli-skill install --force      Force reinstall
  npx db-cli-skill install -v v1.0.0    Install v1.0.0
  npx db-cli-skill install --verify     Check if installed
  npx db-cli-skill install --check      Check for updates
  npx db-cli-skill install --uninstall  Remove db-cli binary

After installation, configure Claude Code MCP:

  {
    "mcpServers": {
      "db-cli-skill": {
        "command": "npx",
        "args": ["-y", "db-cli-skill"]
      }
    }
  }

Location: ~/.db-cli/bin/db-cli (macOS/Linux)
          %APPDATA%\\.db-cli\\bin\\db-cli.exe (Windows)
`);
}

/**
 * Print Claude Code configuration instructions
 */
function printConfigurationInstructions(): void {
  console.log(`
=== Claude Code Configuration ===

Add the following to your Claude Code settings:

File: ~/.claude/settings.json (macOS/Linux)
      %APPDATA%\\.claude\\settings.json (Windows)

{
  "mcpServers": {
    "db-cli-skill": {
      "command": "npx",
      "args": ["-y", "db-cli-skill"],
      "env": {
        "GITHUB_TOKEN": "your_token_here (optional, for higher rate limits)"
      }
    }
  }
}

Then restart Claude Code and verify with: /mcp list
`);
}

/**
 * Main installation command entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.verify) {
    const isInstalled = await verifyInstallation();
    if (isInstalled) {
      console.log("db-cli is installed and ready to use.");
      process.exit(0);
    } else {
      console.log("db-cli is not installed. Run 'npx db-cli-skill install' to install.");
      process.exit(1);
    }
  }

  if (options.check) {
    const updates = await checkForUpdates();
    if (updates.currentVersion === null) {
      console.log(`Latest version: ${updates.latestVersion}`);
      console.log("db-cli is not installed. Run 'npx db-cli-skill install' to install.");
    } else if (updates.updateAvailable) {
      console.log(`Current version: ${updates.currentVersion}`);
      console.log(`Latest version: ${updates.latestVersion}`);
      console.log("Update available! Run 'npx db-cli-skill install --force' to update.");
    } else {
      console.log(`Current version: ${updates.currentVersion}`);
      console.log("You are running the latest version.");
    }
    process.exit(updates.updateAvailable ? 1 : 0);
  }

  if (options.uninstall) {
    const uninstalled = await uninstallSkill();
    if (uninstalled) {
      console.log("Successfully uninstalled db-cli.");
      process.exit(0);
    } else {
      console.log("db-cli was not installed.");
      process.exit(1);
    }
  }

  // Default: install
  try {
    console.log("=== db-cli-skill Installer ===\n");

    // Ensure directory exists
    const dir = ensureBinaryDirectory();
    console.log(`Install directory: ${dir}`);

    // Check for GITHUB_TOKEN
    if (!process.env.GITHUB_TOKEN) {
      console.log("\nNote: GITHUB_TOKEN not set. GitHub API rate limits may apply.");
      console.log("To avoid rate limiting, set GITHUB_TOKEN environment variable:");
      console.log("  export GITHUB_TOKEN=your_token_here");
      console.log("\nGet a token from: GitHub Settings > Developer settings > Personal access tokens\n");
    }

    // Install
    const result = await installSkill({
      force: options.force,
      version: options.version,
    });

    console.log(`\n=== Installation Complete ===`);
    console.log(`Version: ${result.version}`);
    console.log(`Location: ${result.installedPath}`);
    console.log(`Type: ${result.freshInstall ? "Fresh install" : "Updated"}`);

    // Print configuration instructions
    printConfigurationInstructions();

    process.exit(0);
  } catch (error) {
    console.error(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Export for testing
export { main, parseArgs, printHelp };

// Run if executed directly
main();
