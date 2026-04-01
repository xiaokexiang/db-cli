import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execa } from "execa";
import { getBinaryPath } from "../utils/binary-path.js";

/**
 * Schema for the exec tool
 * WARNING: This tool executes arbitrary SQL - use with caution
 */
const execSchema = z.object({
  host: z.string().describe("Database host address"),
  port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
  user: z.string().describe("Database username"),
  password: z.string().describe("Database password"),
  database: z.string().describe("Database name"),
  sql: z.string().describe("SQL statement to execute"),
  type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
});

type ExecParams = z.infer<typeof execSchema>;

/**
 * Build db-cli command arguments for exec operation
 */
function buildExecArgs(params: ExecParams): string[] {
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

  // SQL statement as the last argument
  args.push(params.sql);

  return args;
}

/**
 * Register the exec tool with the MCP server
 */
export function registerExecTool(server: McpServer): void {
  server.tool(
    "exec",
    "Execute arbitrary SQL statements. Supports SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, etc. WARNING: Use with caution as this executes any SQL.",
    {
      host: z.string().describe("Database host address"),
      port: z.number().default(3306).describe("Database port (default: 3306 for MySQL, 5236 for Dameng)"),
      user: z.string().describe("Database username"),
      password: z.string().describe("Database password"),
      database: z.string().describe("Database name"),
      sql: z.string().describe("SQL statement to execute"),
      type: z.enum(["mysql", "dameng"]).default("mysql").describe("Database type"),
    },
    async ({ host, port, user, password, database, sql, type }) => {
      try {
        const binaryPath = getBinaryPath();
        const args = buildExecArgs({ host, port, user, password, database, sql, type });

        const result = await execa(binaryPath, args, {
          encoding: "utf8",
          reject: false,
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large result sets
        });

        if (result.failed || result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error executing SQL: ${result.stderr || result.message}`,
              },
            ],
            isError: true,
          };
        }

        // Format the output
        const output = result.stdout.trim();
        let formattedOutput = output;

        try {
          // Try to parse as JSON and format nicely for SELECT results
          const data = JSON.parse(output);
          if (Array.isArray(data)) {
            if (data.length === 0) {
              formattedOutput = "Query executed successfully. No rows returned.";
            } else if (data.length <= 100) {
              // Format up to 100 rows as a readable table
              formattedOutput = JSON.stringify(data, null, 2);
            } else {
              // For large results, show first few rows and count
              formattedOutput = `${data.length} rows returned.\n\nFirst 10 rows:\n${JSON.stringify(data.slice(0, 10), null, 2)}`;
            }
          } else {
            // Non-array result (e.g., rows affected)
            formattedOutput = JSON.stringify(data, null, 2);
          }
        } catch {
          // Keep raw output if not JSON (e.g., "Query OK, 5 rows affected")
        }

        return {
          content: [
            {
              type: "text",
              text: formattedOutput,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to execute SQL: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export { execSchema, buildExecArgs };
