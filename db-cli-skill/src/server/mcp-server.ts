import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCountTool } from "../tools/count.js";
import { registerDescTool } from "../tools/desc.js";
import { registerExportTool } from "../tools/export.js";
import { registerImportTool } from "../tools/import.js";
import { registerExecTool } from "../tools/exec.js";

/**
 * Create and configure the MCP server with all database tools registered
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "db-cli-skill",
    version: "1.0.0",
  });

  // Register all database tools
  registerCountTool(server);
  registerDescTool(server);
  registerExportTool(server);
  registerImportTool(server);
  registerExecTool(server);

  return server;
}
