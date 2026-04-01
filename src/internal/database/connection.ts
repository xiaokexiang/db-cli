import mysql from 'mysql2/promise';
import { ConnectionConfig } from './config';

// Dameng driver placeholder - will be implemented when driver is available
// For now, we'll use a generic interface

/**
 * Database connection wrapper
 */
export class DatabaseConnection {
  private connection: mysql.Connection | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Open database connection
   */
  async connect(): Promise<void> {
    if (this.config.dbType === 'mysql') {
      await this.connectMySQL();
    } else if (this.config.dbType === 'dameng') {
      throw new Error(
        'Dameng database support for Node.js is not yet available. ' +
          'The dameng Node.js driver is not officially maintained. ' +
          'Consider using the Go version for Dameng support.'
      );
    } else {
      throw new Error(`Unsupported database type: ${this.config.dbType}`);
    }
  }

  /**
   * Connect to MySQL database
   */
  private async connectMySQL(): Promise<void> {
    const port = this.config.port || 3306;
    const database = this.config.database || 'mysql';

    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port,
        user: this.config.user,
        password: this.config.password,
        database,
        charset: 'utf8mb4',
      });

      // Test connection
      await this.connection.ping();
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error}`);
    }
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = unknown>(sql: string): Promise<T> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const [rows] = await this.connection.execute(sql);
    return rows as T;
  }

  /**
   * Execute multiple SQL statements (transaction optional)
   */
  async multiQuery(
    sql: string,
    options: { autocommit?: boolean } = {}
  ): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const { autocommit = true } = options;

    if (!autocommit) {
      // Use transaction
      await this.connection.beginTransaction();
      try {
        await this.connection.query(sql);
        await this.connection.commit();
      } catch (error) {
        await this.connection.rollback();
        throw error;
      }
    } else {
      // Execute multiple statements
      await this.connection.query(sql);
    }
  }

  /**
   * Get table columns/schema
   */
  async getTableColumns(tableName: string): Promise<ColumnSchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLColumns(tableName);
    }
    throw new Error('Dameng not implemented');
  }

  /**
   * Get MySQL table columns
   */
  private async getMySQLColumns(
    tableName: string
  ): Promise<ColumnSchema[]> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.connection.query(
      `SELECT
        COLUMN_NAME as name,
        DATA_TYPE as type,
        CHARACTER_MAXIMUM_LENGTH as charMaxLength,
        NUMERIC_PRECISION as numericPrecision,
        NUMERIC_SCALE as numericScale,
        IS_NULLABLE as isNullable,
        COLUMN_KEY as columnKey,
        COLUMN_DEFAULT as columnDefault,
        EXTRA as extra,
        COLUMN_COMMENT as comment
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName]
    );

    return rows as ColumnSchema[];
  }

  /**
   * Get table indexes
   */
  async getIndexes(tableName: string): Promise<IndexSchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLIndexes(tableName);
    }
    throw new Error('Dameng not implemented');
  }

  /**
   * Get MySQL indexes
   */
  private async getMySQLIndexes(tableName: string): Promise<IndexSchema[]> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.connection.query(
      `SHOW INDEX FROM ${tableName}`,
      []
    );
    return rows as IndexSchema[];
  }

  /**
   * Get foreign keys
   */
  async getForeignKeys(tableName: string): Promise<ForeignKeySchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLForeignKeys(tableName);
    }
    throw new Error('Dameng not implemented');
  }

  /**
   * Get MySQL foreign keys
   */
  private async getMySQLForeignKeys(
    tableName: string
  ): Promise<ForeignKeySchema[]> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.connection.query(
      `SELECT
        COLUMN_NAME as columnName,
        CONSTRAINT_NAME as constraintName,
        REFERENCED_TABLE_NAME as referencedTableName,
        REFERENCED_COLUMN_NAME as referencedColumnName
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName]
    );

    return rows as ForeignKeySchema[];
  }

  /**
   * List all tables
   */
  async listTables(): Promise<string[]> {
    if (this.config.dbType === 'mysql') {
      return this.listMySQLTables();
    }
    throw new Error('Dameng not implemented');
  }

  /**
   * List MySQL tables
   */
  private async listMySQLTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.connection.query(
      'SHOW TABLES',
      []
    );

    // MySQL SHOW TABLES returns array of objects with single key
    const tables = rows as Record<string, string>[];
    const firstKey = Object.keys(tables[0] || {})[0];
    return tables.map((row) => row[firstKey]);
  }

  /**
   * List all databases
   */
  async listDatabases(): Promise<string[]> {
    if (this.config.dbType === 'mysql') {
      return this.listMySQLDatabases();
    }
    throw new Error('Dameng not implemented');
  }

  /**
   * List MySQL databases
   */
  private async listMySQLDatabases(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.connection.query('SHOW DATABASES', []);
    return (rows as Record<string, string>[]).map((row) => row.Database);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Test connection
   */
  async test(): Promise<void> {
    await this.connect();
  }
}

/**
 * Schema types
 */
export interface ColumnSchema {
  name: string;
  type: string;
  charMaxLength?: number;
  numericPrecision?: number;
  numericScale?: number;
  isNullable: string;
  columnKey: string;
  columnDefault?: string;
  extra: string;
  comment: string;
}

export interface IndexSchema {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
  Collation: string;
  Cardinality: number;
  Sub_part?: number;
  Packed?: Buffer;
  Null: string;
  Index_type: string;
  Comment: string;
  Index_comment: string;
}

export interface ForeignKeySchema {
  columnName: string;
  constraintName: string;
  referencedTableName: string;
  referencedColumnName: string;
}
