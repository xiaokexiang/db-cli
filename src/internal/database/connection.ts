import mysql from 'mysql2/promise';
import dmdb from 'dmdb';
import { ConnectionConfig } from './config';

/**
 * Database connection wrapper supporting MySQL and Dameng (DM8)
 */
export class DatabaseConnection {
  private mysqlConnection: mysql.Connection | null = null;
  private damengConnection: dmdb.Connection | null = null;
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
      await this.connectDameng();
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
      this.mysqlConnection = await mysql.createConnection({
        host: this.config.host,
        port,
        user: this.config.user,
        password: this.config.password,
        database,
        charset: 'utf8mb4',
      });

      // Test connection
      await this.mysqlConnection.ping();
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error}`);
    }
  }

  /**
   * Connect to Dameng database
   */
  private async connectDameng(): Promise<void> {
    const port = this.config.port || 5236;
    const schema = this.config.database || this.config.user;

    try {
      // Build Dameng connection string
      // Format: host:port/schema or connectString
      const connectString = `${this.config.host}:${port}/${schema}`;

      this.damengConnection = await dmdb.getConnection({
        connectString,
        user: this.config.user,
        password: this.config.password,
      });

      // Test connection with simple query
      await this.damengConnection.execute('SELECT 1 FROM DUAL');
    } catch (error) {
      throw new Error(`Dameng connection failed: ${error}`);
    }
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = unknown>(sql: string): Promise<T> {
    if (!this.mysqlConnection && !this.damengConnection) {
      throw new Error('Not connected to database');
    }

    if (this.config.dbType === 'mysql') {
      const [rows] = await this.mysqlConnection!.execute(sql);
      return rows as T;
    } else {
      // Dameng
      const result = await this.damengConnection!.execute<T>(sql);
      return result.rows as T;
    }
  }

  /**
   * Execute multiple SQL statements (transaction optional)
   */
  async multiQuery(
    sql: string,
    options: { autocommit?: boolean } = {}
  ): Promise<void> {
    if (!this.mysqlConnection && !this.damengConnection) {
      throw new Error('Not connected to database');
    }

    const { autocommit = true } = options;

    if (this.config.dbType === 'mysql') {
      if (!autocommit) {
        await this.mysqlConnection!.beginTransaction();
        try {
          await this.mysqlConnection!.query(sql);
          await this.mysqlConnection!.commit();
        } catch (error) {
          await this.mysqlConnection!.rollback();
          throw error;
        }
      } else {
        await this.mysqlConnection!.query(sql);
      }
    } else {
      // Dameng - use autoCommit option in execute
      if (!autocommit) {
        // Dameng uses autoCommit at connection or execute level
        // Start transaction manually
        await this.damengConnection!.execute('BEGIN');
        try {
          await this.damengConnection!.execute(sql);
          await this.damengConnection!.commit();
        } catch (error) {
          await this.damengConnection!.rollback();
          throw error;
        }
      } else {
        await this.damengConnection!.execute(sql);
      }
    }
  }

  /**
   * Get table columns/schema
   */
  async getTableColumns(tableName: string): Promise<ColumnSchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLColumns(tableName);
    } else if (this.config.dbType === 'dameng') {
      return this.getDamengColumns(tableName);
    }
    throw new Error(`Unsupported database type: ${this.config.dbType}`);
  }

  /**
   * Get MySQL table columns
   */
  private async getMySQLColumns(tableName: string): Promise<ColumnSchema[]> {
    if (!this.mysqlConnection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.mysqlConnection.query(
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
   * Get Dameng table columns
   */
  private async getDamengColumns(tableName: string): Promise<ColumnSchema[]> {
    if (!this.damengConnection) {
      throw new Error('Not connected');
    }

    // Dameng system views for column information
    const sql = `
      SELECT
        COLUMN_NAME as name,
        DATA_TYPE as type,
        DATA_LENGTH as charMaxLength,
        DATA_PRECISION as numericPrecision,
        DATA_SCALE as numericScale,
        NULLABLE as isNullable,
        '' as columnKey,
        DATA_DEFAULT as columnDefault,
        '' as extra,
        '' as comment
      FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = ?
      ORDER BY COLUMN_ID
    `;

    const result = await this.damengConnection.execute(sql, [tableName.toUpperCase()]);
    return result.rows as ColumnSchema[];
  }

  /**
   * Get table indexes
   */
  async getIndexes(tableName: string): Promise<IndexSchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLIndexes(tableName);
    } else if (this.config.dbType === 'dameng') {
      return this.getDamengIndexes(tableName);
    }
    throw new Error(`Unsupported database type: ${this.config.dbType}`);
  }

  /**
   * Get MySQL indexes
   */
  private async getMySQLIndexes(tableName: string): Promise<IndexSchema[]> {
    if (!this.mysqlConnection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.mysqlConnection.query(
      `SHOW INDEX FROM ${tableName}`,
      []
    );
    return rows as IndexSchema[];
  }

  /**
   * Get Dameng indexes
   */
  private async getDamengIndexes(tableName: string): Promise<IndexSchema[]> {
    if (!this.damengConnection) {
      throw new Error('Not connected');
    }

    const sql = `
      SELECT
        i.INDEX_NAME as Key_name,
        c.COLUMN_NAME as Column_name,
        c.COLUMN_POSITION as Seq_in_index,
        CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 0 ELSE 1 END as Non_unique
      FROM USER_IND_COLUMNS c
      JOIN USER_INDEXES i ON c.INDEX_NAME = i.INDEX_NAME
      WHERE c.TABLE_NAME = ?
      ORDER BY c.INDEX_NAME, c.COLUMN_POSITION
    `;

    const result = await this.damengConnection.execute(sql, [tableName.toUpperCase()]);
    return result.rows as IndexSchema[];
  }

  /**
   * Get foreign keys
   */
  async getForeignKeys(tableName: string): Promise<ForeignKeySchema[]> {
    if (this.config.dbType === 'mysql') {
      return this.getMySQLForeignKeys(tableName);
    } else if (this.config.dbType === 'dameng') {
      return this.getDamengForeignKeys(tableName);
    }
    throw new Error(`Unsupported database type: ${this.config.dbType}`);
  }

  /**
   * Get MySQL foreign keys
   */
  private async getMySQLForeignKeys(
    tableName: string
  ): Promise<ForeignKeySchema[]> {
    if (!this.mysqlConnection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.mysqlConnection.query(
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
   * Get Dameng foreign keys
   */
  private async getDamengForeignKeys(
    tableName: string
  ): Promise<ForeignKeySchema[]> {
    if (!this.damengConnection) {
      throw new Error('Not connected');
    }

    const sql = `
      SELECT
        a.COLUMN_NAME as columnName,
        a.CONSTRAINT_NAME as constraintName,
        c.TABLE_NAME as referencedTableName,
        a.REFERENCED_COLUMN as referencedColumnName
      FROM USER_CONSTRAINTS c
      JOIN USER_CONS_COLUMNS a ON c.CONSTRAINT_NAME = a.CONSTRAINT_NAME
      WHERE c.CONSTRAINT_TYPE = 'R'
        AND c.TABLE_NAME = ?
    `;

    const result = await this.damengConnection.execute(sql, [tableName.toUpperCase()]);
    return result.rows as ForeignKeySchema[];
  }

  /**
   * List all tables
   */
  async listTables(): Promise<string[]> {
    if (this.config.dbType === 'mysql') {
      return this.listMySQLTables();
    } else if (this.config.dbType === 'dameng') {
      return this.listDamengTables();
    }
    throw new Error(`Unsupported database type: ${this.config.dbType}`);
  }

  /**
   * List MySQL tables
   */
  private async listMySQLTables(): Promise<string[]> {
    if (!this.mysqlConnection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.mysqlConnection.query('SHOW TABLES', []);
    const tables = rows as Record<string, string>[];
    const firstKey = Object.keys(tables[0] || {})[0];
    return tables.map((row) => row[firstKey]);
  }

  /**
   * List Dameng tables
   */
  private async listDamengTables(): Promise<string[]> {
    if (!this.damengConnection) {
      throw new Error('Not connected');
    }

    const sql = `SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME`;
    const result = await this.damengConnection.execute(sql);
    return (result.rows as Record<string, unknown>[]).map((row) =>
      (row as Record<string, unknown>).TABLE_NAME as string
    );
  }

  /**
   * List all databases/schemas
   */
  async listDatabases(): Promise<string[]> {
    if (this.config.dbType === 'mysql') {
      return this.listMySQLDatabases();
    } else if (this.config.dbType === 'dameng') {
      return this.listDamengSchemas();
    }
    throw new Error(`Unsupported database type: ${this.config.dbType}`);
  }

  /**
   * List MySQL databases
   */
  private async listMySQLDatabases(): Promise<string[]> {
    if (!this.mysqlConnection) {
      throw new Error('Not connected');
    }

    const [rows] = await this.mysqlConnection.query('SHOW DATABASES', []);
    return (rows as Record<string, string>[]).map((row) => row.Database);
  }

  /**
   * List Dameng schemas (users)
   */
  private async listDamengSchemas(): Promise<string[]> {
    if (!this.damengConnection) {
      throw new Error('Not connected');
    }

    const sql = `SELECT USERNAME FROM DBA_USERS ORDER BY USERNAME`;
    const result = await this.damengConnection.execute(sql);
    return (result.rows as Record<string, unknown>[]).map((row) =>
      (row as Record<string, unknown>).USERNAME as string
    );
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.mysqlConnection) {
      await this.mysqlConnection.end();
      this.mysqlConnection = null;
    }
    if (this.damengConnection) {
      await this.damengConnection.close();
      this.damengConnection = null;
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
  Table?: string;
  Non_unique?: number;
  Key_name: string;
  Seq_in_index?: number;
  Column_name: string;
  Collation?: string;
  Cardinality?: number;
  Sub_part?: number;
  Packed?: Buffer;
  Null?: string;
  Index_type?: string;
  Comment?: string;
  Index_comment?: string;
}

export interface ForeignKeySchema {
  columnName: string;
  constraintName: string;
  referencedTableName: string;
  referencedColumnName: string;
}
