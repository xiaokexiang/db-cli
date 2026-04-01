import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../internal/database/connection';
import { parseDSN } from '../internal/database/config';

interface ImportOptions {
  file: string;
  autocommit: boolean;
}

export const importCmd = new Command('import');

importCmd
  .description('Import data from SQL or JSON file')
  .configureHelp({ showGlobalOptions: false })
  .requiredOption('-f, --file <path>', 'Input file path (.sql or .json)')
  .option('--autocommit', 'Auto-commit each statement', true)
  .hook('preAction', (thisCommand) => {
    const parent = thisCommand.parent as Command;
    if (!parent.opts().connection) {
      console.error('Error: --connection (-c) is required. Example: -c "mysql://root:password@localhost:3306/mydb"');
      process.exit(1);
    }
  })
  .action(async (options: ImportOptions, actionCommand: Command) => {
    const parent = actionCommand.parent as Command;
    const connection = parent.opts().connection;
    const ext = path.extname(options.file).toLowerCase();
    if (ext !== '.sql' && ext !== '.json') {
      console.error(
        `Error: unsupported file format '${ext}': use .sql or .json extension`
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

      if (ext === '.sql') {
        await importSQLFile(db, options.file, options.autocommit);
      } else {
        await importJSONFile(db, options.file, options.autocommit);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      await db.close();
    }
  });

async function importSQLFile(
  db: DatabaseConnection,
  filePath: string,
  autocommit: boolean
): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Remove SQL comments (lines starting with --)
  const lines = content.split('\n');
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('--') && trimmed !== '';
  });
  const cleanedContent = cleanedLines.join('\n');

  // Parse SQL statements
  const statements = parseSQLStatements(cleanedContent);
  if (statements.length === 0) {
    throw new Error('No SQL statements found in file');
  }

  let statementCount = 0;

  if (autocommit) {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      await db.multiQuery(stmt, { autocommit: true });
      statementCount++;
    }
  } else {
    // Execute all in a transaction
    const fullSql = statements.join(';');
    await db.multiQuery(fullSql, { autocommit: false });
    statementCount = statements.length;
  }

  console.log(
    `Successfully executed ${statementCount} statement(s) from ${filePath}`
  );
}

async function importJSONFile(
  db: DatabaseConnection,
  filePath: string,
  autocommit: boolean
): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse JSON array
  let data: Record<string, unknown>[];
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON file must contain an array');
    }
    data = parsed;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`);
  }

  if (data.length === 0) {
    throw new Error('JSON file is empty');
  }

  // Infer table name from file name
  const tableName = path.basename(filePath, path.extname(filePath));

  // Generate INSERT statements
  const insertStatements = data.map((row) =>
    generateInsertSQL(tableName, row, 'mysql')
  );
  const fullSql = insertStatements.join('\n');

  if (autocommit) {
    await db.multiQuery(fullSql, { autocommit: true });
  } else {
    await db.multiQuery(fullSql, { autocommit: false });
  }

  console.log(`Successfully imported ${data.length} row(s) from ${filePath}`);
}

function parseSQLStatements(content: string): string[] {
  return content
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt !== '');
}

function generateInsertSQL(
  tableName: string,
  row: Record<string, unknown>,
  dbType: 'mysql' | 'dameng'
): string {
  const columns: string[] = [];
  const values: string[] = [];

  for (const [col, val] of Object.entries(row)) {
    columns.push(col);
    values.push(formatValue(val));
  }

  const quoteChar = dbType === 'dameng' ? '"' : '`';
  const columnList = columns.map((c) => `${quoteChar}${c}${quoteChar}`).join(', ');
  const valueList = values.join(', ');

  return `INSERT INTO ${quoteChar}${tableName}${quoteChar} (${columnList}) VALUES (${valueList});`;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }

  switch (typeof val) {
    case 'boolean':
      return val ? '1' : '0';
    case 'number':
      return String(val);
    case 'string':
      // Check if it's an ISO 8601 timestamp
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (isoDateRegex.test(val)) {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          const sqlDate = date.toISOString().replace('T', ' ').substring(0, 19);
          return `'${sqlDate}'`;
        }
      }
      // Escape single quotes
      const escaped = val.replace(/'/g, "''");
      return `'${escaped}'`;
    default:
      return `'${String(val)}'`;
  }
}
