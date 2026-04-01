import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../internal/database/connection';
import { parseDSN } from '../internal/database/config';
import { scanRows, toInsert, toJSON } from '../internal/output/formatter';

interface ExportOptions {
  query?: string;
  table?: string;
  output: string;
}

export const exportCmd = new Command('export');

exportCmd
  .description('Export database data')
  .configureHelp({ showGlobalOptions: false })
  .option('-q, --query <sql>', 'SQL query to execute and export')
  .option('-t, --table <name>', 'Table name to export (structure + data)')
  .requiredOption(
    '-o, --output <path>',
    'Output file path (format auto-detected from extension: .sql or .json)'
  )
  .hook('preAction', (thisCommand) => {
    const parent = thisCommand.parent as Command;
    if (!parent.opts().connection) {
      console.error('Error: --connection (-c) is required. Example: -c "mysql://root:password@localhost:3306/mydb"');
      process.exit(1);
    }
  })
  .action(async (options: ExportOptions, actionCommand: Command) => {
    const parent = actionCommand.parent as Command;
    const connection = parent.opts().connection;
    // Validate: either --query or --table must be provided, not both
    if (!options.query && !options.table) {
      console.error('Error: must specify either --query or --table');
      process.exit(1);
    }
    if (options.query && options.table) {
      console.error('Error: cannot specify both --query and --table');
      process.exit(1);
    }

    // Validate output file extension
    const ext = path.extname(options.output).toLowerCase();
    if (ext !== '.sql' && ext !== '.json') {
      console.error(
        `Error: unsupported output format '${ext}': use .sql or .json extension`
      );
      process.exit(1);
    }

    let config;
    try {
      config = parseDSN(connection);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }

    const db = new DatabaseConnection(config);

    try {
      await db.connect();

      if (options.query) {
        await exportQueryResults(db, options.query, options.output, ext);
      } else if (options.table) {
        await exportTableData(db, options.table, options.output, ext);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      await db.close();
    }
  });

async function exportQueryResults(
  db: DatabaseConnection,
  query: string,
  outputPath: string,
  ext: string
): Promise<void> {
  const result = await db.query<unknown[]>(query);
  const rows = scanRows(result);

  let content: string;

  if (ext === '.sql') {
    content = toInsert(rows, 'query_result', 'mysql');
    if (!content || content.includes('no results')) {
      throw new Error('Query returned no results');
    }
  } else {
    content = toJSON(rows, true);
  }

  writeExportFile(outputPath, content, 'Query export', ext);
  console.log(`Successfully exported query results to ${outputPath}`);
}

async function exportTableData(
  db: DatabaseConnection,
  tableName: string,
  outputPath: string,
  ext: string
): Promise<void> {
  let content: string;

  if (ext === '.sql') {
    // Get CREATE TABLE statement
    const createTable = await getCreateTable(db, tableName);
    const result = await db.query<unknown[]>(`SELECT * FROM ${tableName}`);
    const rows = scanRows(result);
    const insertSQL = toInsert(rows, tableName, 'mysql');

    content = `${createTable}\n\n${insertSQL}`;
  } else {
    // Export as JSON
    const result = await db.query<unknown[]>(`SELECT * FROM ${tableName}`);
    const rows = scanRows(result);
    content = toJSON(rows, true);
  }

  writeExportFile(outputPath, content, 'Table export', ext);
  console.log(`Successfully exported table '${tableName}' to ${outputPath}`);
}

function writeExportFile(
  path: string,
  content: string,
  header: string,
  ext: string
): void {
  let finalContent = content;

  if (ext === '.sql') {
    // Add SQL header comment
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    finalContent = `-- ${header}\n-- Exported by db-cli on ${timestamp}\n\n${content}`;
  }

  fs.writeFileSync(path, finalContent, 'utf-8');
}

async function getCreateTable(
  db: DatabaseConnection,
  tableName: string
): Promise<string> {
  const [rows] = await (db as any).query(`SHOW CREATE TABLE ${tableName}`);
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0]['Create Table'] || rows[0]['create table'];
  }
  throw new Error(`Failed to get CREATE TABLE for ${tableName}`);
}
