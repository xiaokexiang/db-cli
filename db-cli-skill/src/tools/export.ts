import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import { getBinaryPath } from "../utils/binary-path.js";
import * as fs from "node:fs";

/**
 * Schema for the export tool
 */
const exportSchema = z
  .object({
    host: z.string().describe("Database host address"),
    port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
    user: z.string().describe("Database username"),
    password: z.string().describe("Database password"),
    database: z.string().describe("Database name"),
    table: z.string().optional().describe("Table name to export (either table or query must be provided)"),
    query: z.string().optional().describe("SQL query to export (either table or query must be provided)"),
    output: z.string().describe("Output file path"),
    format: z.enum(["insert", "ddl", "csv", "json"]).default("insert").describe("Export format"),
    type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
  })
  .refine((data) => data.table || data.query, {
    message: "Either table or query must be provided",
  });

type ExportParams = z.infer<typeof exportSchema>;

/**
 * Build db-cli command arguments for export operation
 */
function buildExportArgs(params: ExportParams): string[] {
  const args = [
    "export",
    "-h", params.host,
    "-P", params.port.toString(),
    "-u", params.user,
    "-p", params.password,
    "-d", params.database,
    "--output", params.output,
    "--format", params.format,
  ];

  if (params.type === "dameng") {
    args.push("-t", "dameng");
  }

  if (params.table) {
    args.push("--table", params.table);
  }

  if (params.query) {
    args.push("--query", params.query);
  }

  return args;
}

/**
 * Register the export tool with the MCP server
 */
export function registerExportTool(server: McpServer): void {
  server.tool(
    "export",
    "Export table data or query results to a file. Supports INSERT statements, DDL, CSV, and JSON formats.",
    {
      host: z.string().describe("Database host address"),
      port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
      user: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      database: z.string().describe("Database name"),
      table: z.string().optional().describe("Table name to export (either table or query must be provided)"),
      query: z.string().optional().describe("SQL query to export (either table or query must be provided)"),
      output: z.string().describe("Output file path"),
      format: z.enum(["insert", "ddl", "csv", "json"]).default("insert").describe("Export format"),
      type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
    },
    async ({ host, port, user, password, database, table, query, output, format, type }) => {
      try {
        const binaryPath = getBinaryPath();
        const args = buildExportArgs({ host, port, user, password, database, table, query, output, format, type });

        const result = await execa(binaryPath, args, {
          encoding: "utf8",
          reject: false,
        });

        if (result.failed || result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error exporting data: ${result.stderr || result.message}`,
              },
            ],
            isError: true,
          };
        }

        // Verify the output file was created
        let fileExists = false;
        let fileSize = 0;
        try {
          const stats = fs.statSync(output);
          fileExists = true;
          fileSize = stats.size;
        } catch {
          // File may not exist or may be in a different location
        }

        const what = table ? `Table "${table}"` : "Query results";
        const formatText = format.toUpperCase();

        return {
          content: [
            {
              type: "text",
              text: `${what} exported to "${output}" in ${formatText} format.${fileExists ? ` (${(fileSize / 1024).toFixed(2)} KB)` : ""}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to export data: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { exportSchema, buildExportArgs };
