import { Command } from 'commander';
import { DatabaseConnection } from '../internal/database/connection';
import { parseDSN } from '../internal/database/config';
import { toJSON } from '../internal/output/formatter';

interface DescOptions {
  table?: string;
  indexes: boolean;
  foreignKeys: boolean;
  databases: boolean;
  tables: boolean;
}

export const descCmd = new Command('desc');

descCmd
  .description('Describe database schema')
  .configureHelp({ showGlobalOptions: false })
  .option('-t, --table <name>', 'Table name to describe')
  .option('-i, --indexes', 'Show indexes for the table')
  .option('-k, --foreign-keys', 'Show foreign keys for the table')
  .option('-D, --databases', 'List all databases')
  .option('-B, --tables', 'List all tables in current database')
  .hook('preAction', (thisCommand) => {
    const parent = thisCommand.parent as Command;
    if (!parent.opts().connection) {
      console.error('Error: --connection (-c) is required. Example: -c "mysql://root:password@localhost:3306/mydb"');
      process.exit(1);
    }
  })
  .action(async (options: DescOptions, actionCommand: Command) => {
    const parent = actionCommand.parent as Command;
    const connection = parent.opts().connection;
    // Validate: at least one flag must be provided
    if (
      !options.databases &&
      !options.tables &&
      !options.table &&
      !options.indexes &&
      !options.foreignKeys
    ) {
      console.error(
        'Error: must specify one of: --table, --indexes, --foreign-keys, --databases, --tables'
      );
      process.exit(1);
    }

    // Validate flag combinations
    if (options.databases && options.tables) {
      console.error('Error: cannot specify both --databases and --tables');
      process.exit(1);
    }
    if (options.databases && options.table) {
      console.error('Error: cannot specify both --databases and --table');
      process.exit(1);
    }
    if (options.databases && options.indexes) {
      console.error('Error: --databases cannot be combined with --indexes');
      process.exit(1);
    }
    if (options.databases && options.foreignKeys) {
      console.error('Error: --databases cannot be combined with --foreign-keys');
      process.exit(1);
    }
    if (options.tables && options.indexes) {
      console.error('Error: --tables cannot be combined with --indexes');
      process.exit(1);
    }
    if (options.tables && options.foreignKeys) {
      console.error('Error: --tables cannot be combined with --foreign-keys');
      process.exit(1);
    }
    if (options.indexes && options.foreignKeys) {
      console.error('Error: cannot specify both --indexes and --foreign-keys');
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

      // Route based on flags
      if (options.databases) {
        await listDatabases(db);
      } else if (options.tables) {
        await listTables(db);
      } else if (options.table) {
        if (options.indexes) {
          await showIndexes(db, options.table);
        } else if (options.foreignKeys) {
          await showForeignKeys(db, options.table);
        } else {
          await describeTable(db, options.table);
        }
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      await db.close();
    }
  });

async function describeTable(
  db: DatabaseConnection,
  tableName: string
): Promise<void> {
  const columns = await db.getTableColumns(tableName);
  console.log(JSON.stringify(columns, null, 2));
}

async function showIndexes(
  db: DatabaseConnection,
  tableName: string
): Promise<void> {
  const indexes = await db.getIndexes(tableName);
  console.log(JSON.stringify(indexes, null, 2));
}

async function showForeignKeys(
  db: DatabaseConnection,
  tableName: string
): Promise<void> {
  const foreignKeys = await db.getForeignKeys(tableName);
  console.log(JSON.stringify(foreignKeys, null, 2));
}

async function listTables(db: DatabaseConnection): Promise<void> {
  const tables = await db.listTables();
  console.log(JSON.stringify(tables, null, 2));
}

async function listDatabases(db: DatabaseConnection): Promise<void> {
  const databases = await db.listDatabases();
  console.log(JSON.stringify(databases, null, 2));
}
