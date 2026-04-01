import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import { getBinaryPath } from "../utils/binary-path.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Schema for the import tool
 */
const importSchema = z.object({
  host: z.string().describe("Database host address"),
  port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
  user: z.string().describe("Database username"),
  password: z.string().describe("Database password"),
  database: z.string().describe("Database name"),
  file: z.string().describe("SQL file path to import"),
  type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
});

type ImportParams = z.infer<typeof importSchema>;

/**
 * Build db-cli command arguments for import operation
 */
function buildImportArgs(params: ImportParams): string[] {
  const args = [
    "import",
    "-h", params.host,
    "-P", params.port.toString(),
    "-u", params.user,
    "-p", params.password,
    "-d", params.database,
    "--file", params.file,
  ];

  if (params.type === "dameng") {
    args.push("-t", "dameng");
  }

  return args;
}

/**
 * Register the import tool with the MCP server
 */
export function registerImportTool(server: McpServer): void {
  server.tool(
    "import",
    "Import SQL file into the database. Executes all SQL statements in the file.",
    {
      host: z.string().describe("Database host address"),
      port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
      user: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      database: z.string().describe("Database name"),
      file: z.string().describe("SQL file path to import"),
      type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
    },
    async ({ host, port, user, password, database, file, type }) => {
      try {
        // Validate file exists
        const resolvedPath = path.resolve(file);
        if (!fs.existsSync(resolvedPath)) {
          return {
            content: [
              {
                type: "text",
                text: `File not found: ${file}`,
              },
            ],
            isError: true,
          };
        }

        const binaryPath = getBinaryPath();
        const args = buildImportArgs({ host, port, user, password, database, file: resolvedPath, type });

        const result = await execa(binaryPath, args, {
          encoding: "utf8",
          reject: false,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large imports
        });

        if (result.failed || result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error importing SQL file: ${result.stderr || result.message}`,
              },
            ],
            isError: true,
          };
        }

        // Parse output to get summary
        const output = result.stdout.trim();
        let summary = output;
        try {
          // Try to parse as JSON for better formatting
          const data = JSON.parse(output);
          if (data.rowsAffected !== undefined) {
            summary = `${data.rowsAffected} rows affected`;
          }
          if (data.tablesImported !== undefined) {
            summary += `, ${data.tablesImported} tables imported`;
          }
        } catch {
          // Keep raw output if not JSON
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully imported SQL file "${file}". ${summary}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to import SQL file: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { importSchema, buildImportArgs };
