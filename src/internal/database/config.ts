/**
 * Database connection configuration
 */
export interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  dbType: 'mysql' | 'dameng';
}

/**
 * Parse DSN URL into ConnectionConfig
 * Format: type://user:password@host:port/database
 * Examples:
 *   - mysql://root:password@localhost:3306/mydb
 *   - dameng://SYSDBA:SYSDBA001@10.50.8.44:5236
 */
export function parseDSN(dsn: string): ConnectionConfig {
  if (!dsn) {
    throw new Error('Empty DSN');
  }

  try {
    const url = new URL(dsn);
    const dbType = url.protocol.replace(':', '') as 'mysql' | 'dameng';

    if (dbType !== 'mysql' && dbType !== 'dameng') {
      throw new Error(
        `Unsupported database type: ${dbType} (use 'mysql' or 'dameng')`
      );
    }

    // Extract user info
    const user = url.username;
    const password = url.password;

    // Parse host and port
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : 0;

    // Extract database name
    let database = url.pathname.replace('/', '');
    if (!database) {
      // Default database based on type
      database = dbType === 'mysql' ? 'mysql' : '';
    }

    return {
      host,
      port,
      user,
      password,
      database,
      dbType,
    };
  } catch (error) {
    throw new Error(`Invalid DSN format: ${error}`);
  }
}

/**
 * Build DSN from ConnectionConfig
 */
export function buildDSN(cfg: ConnectionConfig): string {
  if (!cfg.host) {
    throw new Error('Host is required');
  }
  if (!cfg.user) {
    throw new Error('User is required');
  }

  // Apply default port
  let port = cfg.port;
  if (!port) {
    port = cfg.dbType === 'mysql' ? 3306 : 5236;
  }

  // Apply default database
  let database = cfg.database;
  if (!database) {
    database = cfg.dbType === 'mysql' ? 'mysql' : cfg.user;
  }

  if (cfg.dbType === 'mysql') {
    // MySQL DSN format
    const escapedPassword = encodeURIComponent(cfg.password);
    return `mysql://${cfg.user}:${escapedPassword}@${cfg.host}:${port}/${database}?charset=utf8mb4`;
  } else {
    // Dameng DSN format (using node-oracledb compatible format)
    const escapedPassword = encodeURIComponent(cfg.password);
    return `dameng://${cfg.user}:${escapedPassword}@${cfg.host}:${port}/${database}`;
  }
}
