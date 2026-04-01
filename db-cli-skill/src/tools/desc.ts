import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import { getBinaryPath } from "../utils/binary-path.js";

/**
 * Schema for the desc tool
 */
const descSchema = z.object({
  host: z.string().describe("Database host address"),
  port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
  user: z.string().describe("Database username"),
  password: z.string().describe("Database password"),
  database: z.string().describe("Database name"),
  table: z.string().describe("Table name to describe"),
  indexes: z.boolean().default(false).describe("Show index information"),
  foreignKeys: z.boolean().default(false).describe("Show foreign key constraints"),
  type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
});

type DescParams = z.infer<typeof descSchema>;

/**
 * Build db-cli command arguments for desc operation
 */
function buildDescArgs(params: DescParams): string[] {
  const args = [
    "desc",
    "-h", params.host,
    "-P", params.port.toString(),
    "-u", params.user,
    "-p", params.password,
    "-d", params.database,
    "--table", params.table,
  ];

  if (params.type === "dameng") {
    args.push("-t", "dameng");
  }

  if (params.indexes) {
    args.push("--indexes");
  }

  if (params.foreignKeys) {
    args.push("--foreign-keys");
  }

  return args;
}

/**
 * Register the desc tool with the MCP server
 */
export function registerDescTool(server: McpServer): void {
  server.tool(
    "desc",
    "Describe a database table structure. Shows columns, data types, nullability, and keys. Can also show indexes and foreign keys.",
    {
      host: z.string().describe("Database host address"),
      port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
      user: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      database: z.string().describe("Database name"),
      table: z.string().describe("Table name to describe"),
      indexes: z.boolean().default(false).describe("Show index information"),
      foreignKeys: z.boolean().default(false).describe("Show foreign key constraints"),
      type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
    },
    async ({ host, port, user, password, database, table, indexes, foreignKeys, type }) => {
      try {
        const binaryPath = getBinaryPath();
        const args = buildDescArgs({ host, port, user, password, database, table, indexes, foreignKeys, type });

        const result = await execa(binaryPath, args, {
          encoding: "utf8",
          reject: false,
        });

        if (result.failed || result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error describing table: ${result.stderr || result.message}`,
              },
            ],
            isError: true,
          };
        }

        // Format the output
        let output = result.stdout.trim();
        try {
          // Try to parse as JSON and format nicely
          const data = JSON.parse(output);
          if (Array.isArray(data)) {
            output = data.map((row) => JSON.stringify(row, null, 2)).join("\n");
          }
        } catch {
          // Keep raw output if not JSON
        }

        return {
          content: [
            {
              type: "text",
              text: `Table structure for "${table}":\n\n${output}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to describe table: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { descSchema, buildDescArgs };
