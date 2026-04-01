#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Create and configure the MCP server
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "db-cli-skill",
    version: "1.0.0",
  });

  // Tools will be registered here in Plan 03
  // - count: Count rows in a table
  // - desc: Describe table structure
  // - export: Export table data
  // - import: Import data from file
  // - exec: Execute raw SQL

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const server = createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    // Server runs until stdin closes
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fatal error:", errorMessage);
    process.exit(1);
  }
}

// Export for modularity
export { createServer, main };

// Run if executed directly
main();
