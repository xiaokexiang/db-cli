import Table from 'cli-table3';

/**
 * Query result row
 */
export type QueryResult = Record<string, unknown>;

/**
 * Convert sql.Rows-like result to array of objects
 */
export function scanRows(rows: unknown[]): QueryResult[] {
  return rows.map((row) => {
    const result: QueryResult = {};
    if (typeof row === 'object' && row !== null) {
      Object.assign(result, row);
    }
    return result;
  });
}

/**
 * Format query results as ASCII table
 */
export function toTable(rows: QueryResult[]): string {
  if (rows.length === 0) {
    return '0 rows';
  }

  // Extract headers from first row
  const headers = Object.keys(rows[0]);

  // Create table
  const table = new Table({
    head: headers,
    chars: {
      top: '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      bottom: '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '┼',
      right: '│',
      'right-mid': '┤',
      middle: '│',
    },
  });

  // Add rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return 'NULL';
      }
      return String(value);
    });
    table.push(values);
  }

  return table.toString();
}

/**
 * Format query results as JSON
 */
export function toJSON(rows: QueryResult[], pretty = true): string {
  if (pretty) {
    return JSON.stringify(rows, null, 2);
  }
  return JSON.stringify(rows);
}

/**
 * Format query results as INSERT statements
 */
export function toInsert(
  rows: QueryResult[],
  tableName: string,
  dbType: 'mysql' | 'dameng' = 'mysql'
): string {
  if (rows.length === 0) {
    return '-- Query returned no results';
  }

  const quoteChar = dbType === 'dameng' ? '"' : '`';
  const statements: string[] = [];

  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((col) => formatValue(row[col], dbType));

    const columnList = columns
      .map((col) => `${quoteChar}${col}${quoteChar}`)
      .join(', ');
    const valueList = values.join(', ');

    statements.push(
      `INSERT INTO ${quoteChar}${tableName}${quoteChar} (${columnList}) VALUES (${valueList});`
    );
  }

  return statements.join('\n');
}

/**
 * Format a single value for SQL INSERT
 */
function formatValue(
  value: unknown,
  dbType: 'mysql' | 'dameng'
): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    // Check if it's an ISO 8601 timestamp
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (isoDateRegex.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        // Format as SQL timestamp
        const sqlDate = date.toISOString().replace('T', ' ').substring(0, 19);
        return `'${sqlDate}'`;
      }
    }

    // Escape single quotes for SQL
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  // For objects/arrays, convert to string
  return `'${String(value)}'`;
}

/**
 * Get CREATE TABLE statement
 */
export async function getCreateTable(
  db: { query: (sql: string) => Promise<unknown> },
  tableName: string,
  dbType: 'mysql' | 'dameng' = 'mysql'
): Promise<string> {
  if (dbType === 'mysql') {
    const [rows] = await (db as any).query(`SHOW CREATE TABLE ${tableName}`);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0]['Create Table'] || rows[0]['create table'];
    }
  }

  throw new Error('CREATE TABLE not implemented for this database type');
}
