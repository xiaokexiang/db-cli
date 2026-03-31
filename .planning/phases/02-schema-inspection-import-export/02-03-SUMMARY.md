---
plan: 02-03
phase: 02
status: completed
completed_at: 2026-03-31T10:00:00Z
---

# Plan 02-03: Export Command Implementation - Summary

## Objective
Implement export command for querying and exporting data to files

## What Was Built

### Files Created
1. **internal/output/insert.go** - INSERT statement generator
   - `ToInsert(rows *sql.Rows, tableName string) (string, error)` - Converts query results to INSERT statements
   - `formatSQLValue(val interface{}) string` - Formats Go values for SQL INSERT syntax
   - Handles NULL values, string escaping, boolean conversion
   - Generates multi-row INSERT syntax for efficiency

2. **internal/output/ddl.go** - DDL (CREATE TABLE) generator
   - `GetCreateTable(db *gorm.DB, tableName string) (string, error)` - Generates CREATE TABLE statement
   - `detectPrimaryKeys(indexes []map[string]interface{})` - Extracts PK column names
   - `isStringType(colType string)` - Checks if column type is string type
   - `escapeString(s string)` - Escapes special characters for SQL
   - Handles column types, NULL/NOT NULL, DEFAULT values, AUTO_INCREMENT
   - Detects and adds PRIMARY KEY constraints

3. **cmd/export.go** - export command implementation
   - `exportCmd` with 4 flags:
     - `--query, -q` - SQL query to execute and export
     - `--table, -t` - Table name to export
     - `--output, -o` - Output file path (required)
     - `--format, -f` - Output format: "insert" (default) or "ddl"
   - `runExport()` - Main command logic with flag validation
   - `exportQueryResults()` - Exports query results to file
   - `exportTableData()` - Exports entire table structure and/or data
   - `writeExportFile()` - Writes content with header comment

### Key Features

#### Query Export (--query)
```bash
db-cli export -h localhost -u root -p password -d mydb \
  --query="SELECT * FROM users WHERE id > 100" \
  --output=users_filtered.sql --format=insert
```
Exports query results as INSERT statements

#### Table Export (--table)
```bash
# Full table dump (structure + data)
db-cli export -h localhost -u root -p password -d mydb \
  --table=users --output=users_dump.sql --format=ddl

# Data only
db-cli export -h localhost -u root -p password -d mydb \
  --table=users --output=users_data.sql --format=insert
```

#### Output Formats
- **insert**: Generates `INSERT INTO table (cols) VALUES (vals);` statements
- **ddl**: Generates `CREATE TABLE` statement + INSERT statements for data

### INSERT Format Features
- Multi-row INSERT syntax for efficiency
- Proper SQL escaping for strings (quotes, backslashes)
- NULL value handling
- Boolean to TRUE/FALSE conversion
- Numeric value formatting

### DDL Format Features
- Column definitions with types
- NULL/NOT NULL constraints
- DEFAULT values (including CURRENT_TIMESTAMP etc.)
- AUTO_INCREMENT detection
- PRIMARY KEY constraint detection
- ENGINE and CHARSET defaults (InnoDB, utf8mb4)

### File Output
- Header comment with export timestamp
- Clean, readable SQL formatting
- 0644 file permissions

### Flag Validation
- Either --query or --table must be provided, not both
- --output is always required
- --format must be "insert" or "ddl"
- --format=ddl not supported with --query (only makes sense for tables)
- Dameng database type returns "not yet supported" error

## Requirement Coverage
- **IO-02**: 导出查询结果 (INSERT, DDL) ✓ Complete
- **IO-03**: 导出整表 ✓ Complete
- **DQL-02**: 多格式支持 (insert, ddl) ✓ Complete

## Testing
- All existing tests pass
- Build verification: `go build ./...` succeeds
- No regressions in cmd, database, or output packages

## Integration Points
- Uses `database.OpenConnection()` from Phase 1
- Uses `database.GetTableColumns()` and `database.GetIndexes()` from Plan 02-02
- Uses `output.ScanRows()` pattern from Phase 1
- Output file format follows standard SQL dump conventions

## Example Output

### INSERT Format
```sql
INSERT INTO users (id, name, email) VALUES
(1, 'Alice', 'alice@example.com'),
(2, 'Bob', NULL),
(3, 'Charlie', 'charlie@example.com');
```

### DDL Format
```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, name, email) VALUES
(1, 'Alice', 'alice@example.com'),
...
```

## Notes
- Dameng support deferred to Phase 4
- DDL generation focuses on basic column definitions (Phase 2 MVP)
- Complex constraints (foreign keys, unique constraints) can be added later
