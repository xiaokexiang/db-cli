# db-cli

A Node.js cross-platform database CLI tool for MySQL and Dameng (DM8).

## Features

- **MySQL & Dameng Support**: Full-featured database operations for both databases
- **Cross-platform**: Windows/macOS/Linux
- **Simple Connection**: Single DSN URL format (`-c` flag)
- **No Config Files**: Connection parameters specified at runtime
- **Multiple Output Formats**: Table, JSON, and SQL INSERT statements

## Installation

```bash
# Install from npm (recommended)
npm install @xiaokexiang/db-cli

# Or build from source
npm install
npm run build
npm link
```

## Quick Start

### Connection Format

Use `-c` flag with DSN URL:

```bash
# MySQL
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' 'SELECT * FROM users'
```

### DSN URL Format

```
<type>://<user>:<password>@<host>:port/[/<database>]
```

**Parameters:**

- `type`: `mysql` or `dameng`
- `user`: Username
- `password`: Password (URL-encode special characters, e.g., `@` as `%40`)
- `host`: Host address
- `port`: Port (MySQL default: 3306, Dameng default: 5236)
- `database`: Database/schema name (optional)

**Examples:**

```bash
# MySQL - default database
db-cli exec -c 'mysql://root:123456@localhost:3306' 'SELECT 1'

# MySQL - specific database
db-cli exec -c 'mysql://root:123456@localhost:3306/mydb' 'SELECT 1'

# Dameng - default schema (SYSDBA)
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@localhost:5236' 'SELECT 1 FROM DUAL'

# Dameng - specific schema
db-cli exec -c 'dameng://USER:password@localhost:5236/TEST' 'SELECT * FROM users'

# Password with special characters (@ encoded as %40)
db-cli exec -c 'mysql://root:p%40ssword@localhost:3306/mydb' 'SELECT 1'
```

---

## Commands

### exec

Execute SQL statements

```bash
# MySQL - Single SQL statement
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' 'SELECT * FROM users'

# MySQL - Multiple statements (semicolon-separated)
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' 'SELECT 1; SELECT 2; SELECT 3'

# Dameng - Single SQL statement
db-cli exec -c 'dameng://SYSDBA:password@localhost:5236' 'SELECT * FROM users FROM DUAL'

# Table output (default)
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' 'SELECT * FROM users'

# JSON output
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' --format=json 'SELECT * FROM users'

# Generate INSERT statements
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' --format=sql 'SELECT * FROM users'

# Transaction mode (all or nothing)
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' --autocommit=false 'UPDATE users SET age=20; UPDATE users SET status=1'
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--format` | Output format: table, json, sql | table |
| `--autocommit` | Auto-commit each statement | true |

---

### desc

Describe database schema

```bash
# MySQL - List all databases
db-cli desc --databases -c 'mysql://root:password@localhost:3306/mysql'

# MySQL - List all tables
db-cli desc --tables -c 'mysql://root:password@localhost:3306/mydb'

# MySQL - View table structure
db-cli desc -t users -c 'mysql://root:password@localhost:3306/mydb'

# MySQL - View indexes
db-cli desc -t users --indexes -c 'mysql://root:password@localhost:3306/mydb'

# MySQL - View foreign keys
db-cli desc -t users --foreign-keys -c 'mysql://root:password@localhost:3306/mydb'

# Dameng - List all schemas
db-cli desc --databases -c 'dameng://SYSDBA:password@localhost:5236'

# Dameng - List all tables
db-cli desc --tables -c 'dameng://SYSDBA:password@localhost:5236'

# Dameng - View table structure
db-cli desc -t USERS -c 'dameng://SYSDBA:password@localhost:5236'
```

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--table` | `-t` | Table name |
| `--indexes` | | Show indexes |
| `--foreign-keys` | | Show foreign keys |
| `--tables` | | List all tables |
| `--databases` | | List all databases |

---

### export

Export database data to file

```bash
# MySQL - Export query results as SQL (INSERT statements)
db-cli export -c 'mysql://root:password@localhost:3306/mydb' \
  -q "SELECT * FROM users" \
  -o users.sql

# MySQL - Export query results as JSON
db-cli export -c 'mysql://root:password@localhost:3306/mydb' \
  -q "SELECT * FROM users" \
  -o users.json

# MySQL - Export entire table (DDL + data)
db-cli export -c 'mysql://root:password@localhost:3306/mydb' \
  -t users \
  -o users_dump.sql

# MySQL - Export entire table as JSON
db-cli export -c 'mysql://root:password@localhost:3306/mydb' \
  -t users \
  -o users.json

# Dameng - Export query results as JSON
db-cli export -c 'dameng://SYSDBA:password@localhost:5236' \
  -q "SELECT * FROM USERS" \
  -o users.json
```

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--query` | `-q` | SQL query to execute |
| `--table` | `-t` | Table name to export |
| `--output` | `-o` | Output file path (required) |

Supported formats: `.sql` (CREATE + INSERT), `.json`

---

### import

Import SQL or JSON files

```bash
# MySQL - Import SQL file
db-cli import -c 'mysql://root:password@localhost:3306/mydb' -f script.sql

# MySQL - Import JSON file (generates INSERT statements)
db-cli import -c 'mysql://root:password@localhost:3306/mydb' -f data.json

# Dameng - Import SQL file
db-cli import -c 'dameng://SYSDBA:password@localhost:5236' -f script.sql

# Dameng - Import JSON file (generates INSERT statements)
db-cli import -c 'dameng://SYSDBA:password@localhost:5236' -f data.json

# Transaction mode import
db-cli import -c 'mysql://root:password@localhost:3306/mydb' -f data.sql --autocommit=false
```

**Flags:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--file` | `-f` | Input file path (required) | |
| `--autocommit` | | Auto-commit each statement | true |

Supported formats: `.sql`, `.json`

Note: JSON files are imported into a table inferred from the filename (e.g., `data.json` imports to `data` table)

---

## Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--connection` | `-c` | Database connection URL |
| `--help` | `-h` | Display help |

---

## Database Support Status

| Feature | MySQL | Dameng (DM8) |
|---------|-------|--------------|
| exec | ✅ | ✅ |
| desc | ✅ | ✅ |
| export | ✅ | ✅ |
| import | ✅ | ✅ |

Note: Dameng support requires the official dmdb driver. Install with `npm install dmdb`.

---

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev -- exec -c 'mysql://...' 'SELECT 1'

# Run compiled version
npm start -- exec -c 'mysql://...' 'SELECT 1'
```

---

## Notes

### Dameng Database

- **Connection**: Uses official dmdb driver
- **Default Port**: 5236
- **Default Schema**: Username (e.g., SYSDBA)
- **Encryption**: Login encryption is disabled by default for compatibility
- **SQL Syntax**: Use `FROM DUAL` for queries without actual tables
- **Case Sensitivity**: Table names are uppercase by default

### MySQL

- **Default Port**: 3306
- **Default Database**: mysql

---

## License

MIT
