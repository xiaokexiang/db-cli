import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import { getBinaryPath } from "../utils/binary-path.js";

/**
 * Schema for the count tool
 * Used to validate tool parameters and generate MCP tool definition
 */
const countSchema = z.object({
  host: z.string().describe("Database host address"),
  port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
  user: z.string().describe("Database username"),
  password: z.string().describe("Database password"),
  database: z.string().describe("Database name"),
  table: z.string().describe("Table name to count rows"),
  where: z.string().optional().describe("Optional WHERE clause for filtered count"),
  type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
});

type CountParams = z.infer<typeof countSchema>;

/**
 * Build db-cli command arguments for count operation
 */
function buildCountArgs(params: CountParams): string[] {
  const args = [
    "exec",
    "-h", params.host,
    "-P", params.port.toString(),
    "-u", params.user,
    "-p", params.password,
    "-d", params.database,
  ];

  if (params.type === "dameng") {
    args.push("-t", "dameng");
  }

  // Build SQL query
  let sql = `SELECT COUNT(*) FROM ${params.table}`;
  if (params.where) {
    sql += ` WHERE ${params.where}`;
  }

  args.push(sql);
  return args;
}

/**
 * Register the count tool with the MCP server
 */
export function registerCountTool(server: McpServer): void {
  server.tool(
    "count",
    "Count rows in a database table. Use this to get the number of records in a table, optionally with a WHERE filter.",
    {
      host: z.string().describe("Database host address"),
      port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
      user: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      database: z.string().describe("Database name"),
      table: z.string().describe("Table name to count rows"),
      where: z.string().optional().describe("Optional WHERE clause for filtered count"),
      type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
    },
    async ({ host, port, user, password, database, table, where, type }) => {
      try {
        const binaryPath = getBinaryPath();
        const args = buildCountArgs({ host, port, user, password, database, table, where, type });

        const result = await execa(binaryPath, args, {
          encoding: "utf8",
          reject: false,
        });

        if (result.failed || result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error counting rows: ${result.stderr || result.message}`,
              },
            ],
            isError: true,
          };
        }

        // Parse the JSON result from db-cli
        let count: number | string = 0;
        try {
          const output = result.stdout.trim();
          // db-cli returns JSON format: [{"COUNT(*)": 123}]
          const parsed = JSON.parse(output);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const firstRow = parsed[0];
            count = Object.values(firstRow)[0] as number;
          } else {
            count = output;
          }
        } catch {
          count = result.stdout.trim();
        }

        return {
          content: [
            {
              type: "text",
              text: `Table "${table}" has ${count} row(s)${where ? ` (filtered by: ${where})` : ""}.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to count rows: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { countSchema, buildCountArgs };
