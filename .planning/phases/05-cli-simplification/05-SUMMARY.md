# Phase 5: CLI Simplification - DSN URL Only

**Date:** 2026-04-01
**Status:** Complete
**Type:** Design Improvement

---

## Overview

Simplified the CLI design by removing individual connection flags (-h, -u, -p, -d, -t, -P) and keeping only the `-c` / `--connection` flag for DSN URL.

---

## Motivation

### Problems with Previous Design

1. **Too many flags**: Users had to remember 6 different flags for connection
2. **Flag conflicts**: Short flags like `-t` conflicted with command-specific flags (e.g., `desc --tables`)
3. **Redundant**: When using `-c` DSN URL, other flags were unnecessary complexity

### Goals

1. **Simplify**: Single `-c` flag for all connection info
2. **Clear**: DSN format is standard and well-documented
3. **Flexible**: Database/schema is optional with smart defaults

---

## Changes Made

### Files Modified

| File | Changes |
|------|---------|
| `cmd/root.go` | Removed individual flags, kept only `-c` |
| `cmd/ping.go` | Simplified validation logic |
| `cmd/exec.go` | Updated error messages |
| `cmd/import.go` | Updated error messages |
| `cmd/export.go` | Updated error messages |
| `cmd/desc.go` | Updated error messages |
| `internal/database/connection.go` | Added default database logic |
| `README.md` | Updated documentation |

### DSN URL Format

```
<type>://<user>:<password>@<host>:<port>[/<database>]
```

**Components:**
- `type`: `mysql` or `dameng` (required)
- `user`: database username (required)
- `password`: password (required, URL-encode special chars)
- `host`: database host (required)
- `port`: port (optional, defaults: 3306 for MySQL, 5236 for Dameng)
- `database`: database/schema name (optional)

**Default Behavior:**
| Database | Default when not specified |
|----------|---------------------------|
| MySQL | `mysql` (system database) |
| Dameng | username as schema |

---

## Usage Examples

### Basic Connection

```bash
# MySQL - without database (defaults to mysql)
db-cli ping -c 'mysql://root:123456@10.50.8.44:3306'

# MySQL - with database
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' 'SELECT * FROM users'

# Dameng - without schema (defaults to username)
db-cli ping -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236'

# Dameng - with schema
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236/TEST' 'SELECT * FROM table'
```

### Special Characters in Password

Password with special characters must be URL-encoded:

| Character | URL Encoding |
|-----------|--------------|
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `?` | `%3F` |
| `#` | `%23` |

```bash
# Password is "p@ssword" -> "p%40ssword"
db-cli ping -c 'mysql://root:p%40ssword@10.50.8.44:3306'
```

### exec/import/export without Database

For `exec`, `import`, and `export` commands, database is optional. If not specified in DSN:
- MySQL connects to `mysql` system database
- User can specify database in SQL: `SELECT * FROM mydb.table`

```bash
# No database in DSN - MySQL connects to 'mysql'
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306' 'SELECT * FROM mysql.user'

# Database in SQL instead of DSN
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306' 'USE mydb; SELECT * FROM users;'
```

---

## Technical Details

### ParseDSN Function

Added default database logic in `internal/database/connection.go`:

```go
func ParseDSN(dsnURL string) (ConnectionConfig, error) {
    // ... parse URL ...

    cfg.Database = strings.TrimPrefix(u.Path, "/")
    if cfg.Database == "" {
        switch cfg.DBType {
        case "mysql", "":
            cfg.Database = "mysql"
        case "dameng":
            cfg.Database = "" // Will use username in BuildDSN
        }
    }
    return cfg, nil
}
```

### OpenConnection Function

Applies default database if not specified:

```go
func OpenConnection(cfg ConnectionConfig) (*gorm.DB, error) {
    connCfg := cfg
    if connCfg.Database == "" {
        switch connCfg.DBType {
        case "mysql", "":
            connCfg.Database = "mysql"
        case "dameng":
            connCfg.Database = connCfg.User // Use username as schema
        }
    }
    // ... proceed with connection
}
```

---

## Testing

All tests pass:

```
✅ go test ./cmd - PASS
✅ go test ./internal/database - PASS
✅ go test ./internal/output - PASS
```

Test coverage includes:
- DSN parsing with/without database
- Special character handling in passwords
- Default database logic for MySQL and Dameng
- Connection tests with real databases

---

## Breaking Changes

**Yes** - This is a breaking change for users who relied on individual flags.

### Migration Guide

**Before:**
```bash
db-cli exec -h 10.50.8.44 -P 3306 -u root -p password -d mydb -t mysql 'SELECT 1'
```

**After:**
```bash
db-cli exec -c 'mysql://root:password@10.50.8.44:3306/mydb' 'SELECT 1'
```

### Benefits

1. **Shorter**: Less typing for common operations
2. **Clearer**: All connection info in one place
3. **Standard**: DSN URL is a well-known pattern
4. **Safer**: No accidental mixing of flags

---

## Future Considerations

1. **Skill Integration**: Update Claude Code Skill to generate `-c` format
2. **Documentation**: Add DSN URL examples to all command help text
3. **Error Messages**: Improve DSN parsing error messages for common mistakes

---

*Completed: 2026-04-01*
