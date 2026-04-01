import { Command } from 'commander';
import { DatabaseConnection } from '../internal/database/connection';
import { parseDSN, type ConnectionConfig } from '../internal/database/config';
import { scanRows, toTable, toJSON, toInsert, type QueryResult } from '../internal/output/formatter';

interface ExecOptions {
  format: 'table' | 'json' | 'sql';
  autocommit: boolean;
}

export const execCmd = new Command('exec');

execCmd
  .description('Execute SQL statements')
  .configureHelp({ showGlobalOptions: true })
  .argument('<sql>', 'SQL statement(s) to execute')
  .option('--format <format>', 'Output format: table, json, sql', 'table')
  .option('--autocommit', 'Auto-commit each statement', true)
  .hook('preAction', (thisCommand, actionCommand) => {
    // Inherit global -c option
    const parent = thisCommand.parent as Command;
    if (!parent.opts().connection) {
      console.error('Error: --connection (-c) is required. Example: -c "mysql://root:password@localhost:3306/mydb"');
      process.exit(1);
    }
  })
  .action(async (sql: string, options: ExecOptions, actionCommand: Command) => {
    // Get connection from parent (global option)
    const parent = actionCommand.parent as Command;
    const connection = parent.opts().connection;

    if (!sql || sql.trim() === '') {
      console.error('Error: SQL statement cannot be empty');
      process.exit(1);
    }

    if (!['table', 'json', 'sql'].includes(options.format)) {
      console.error(
        `Error: Invalid format '${options.format}': must be table, json, or sql`
      );
      process.exit(1);
    }

    let config: ConnectionConfig;
    try {
      config = parseDSN(connection);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }

    const db = new DatabaseConnection(config);

    try {
      await db.connect();

      // Parse SQL statements
      const statements = parseSQLStatements(sql);
      if (statements.length === 0) {
        console.error('Error: No SQL statements found');
        process.exit(1);
      }

      let lastRows: QueryResult[] | null = null;
      let statementCount = 0;

      if (options.autocommit) {
        // Execute each statement independently
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i].trim();
          if (!stmt) continue;

          if (isSelectQuery(stmt)) {
            const result = await db.query<unknown[]>(stmt);
            lastRows = scanRows(result);
          } else {
            await db.multiQuery(stmt, { autocommit: true });
            statementCount++;
          }
        }
      } else {
        // Execute all statements in a transaction
        const fullSql = statements.join(';');
        await db.multiQuery(fullSql, { autocommit: false });
        statementCount = statements.length;

        // For transaction mode, we can't get results from SELECT
        // This is a limitation - would need more sophisticated transaction handling
      }

      // Output results
      if (lastRows && lastRows.length > 0) {
        formatOutput(lastRows, options.format, 'query_result');
      }

      if (statementCount > 0) {
        console.log(`Successfully executed ${statementCount} statement(s)`);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      await db.close();
    }
  });

function parseSQLStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt !== '');
}

function isSelectQuery(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return (
    upper.startsWith('SELECT') ||
    upper.startsWith('SHOW') ||
    upper.startsWith('DESCRIBE')
  );
}

function formatOutput(
  rows: QueryResult[],
  format: string,
  tableName: string
): void {
  switch (format) {
    case 'json':
      console.log(toJSON(rows));
      break;
    case 'sql':
      console.log(toInsert(rows, tableName));
      break;
    case 'table':
    default:
      console.log(toTable(rows));
      break;
  }
}
