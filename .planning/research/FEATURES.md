# Feature Landscape

**Domain:** Database CLI Tools
**Researched:** 2026-03-31

## Table Stakes Features

Features users expect from any database CLI. Missing = tool feels incomplete or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **SQL Execution** - single statement | Core purpose of any database CLI | Low | `exec "SELECT * FROM users"` |
| **SQL Execution** - from file | Batch operations, migrations, deployments | Low | `exec -f migrations.sql` |
| **Connection parameters** (host/port/user/password/database) | Every database tool needs this | Low | Via flags or config file |
| **Query results display** | Users need to see query output | Low | Default format varies (table/JSON) |
| **Error reporting** | Debugging failed queries | Low | Show error message + line number for file execution |
| **Exit codes** | CI/CD integration, scripting | Low | 0 = success, non-zero = failure |
| **Table structure view** (DESCRIBE/DESC) | Understanding schema without querying information_schema | Medium | Field names, types, nullability, defaults |
| **Transaction control** (autocommit on/off) | Data safety for destructive operations | Medium | `--autocommit` flag or interactive prompt |
| **SQL import** | Loading dumps, migrations, seed data | Medium | Execute .sql file with error handling |
| **SQL export** (dump) | Backups, data migration between environments | Medium | INSERT statements or full dump |

## Differentiators

Features that set db-cli apart from competitors. Not expected, but highly valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Natural language interface** (via Skill layer) | Users don't need to know SQL or connection parameters | High | "How many accounts are in table X?" → auto-generates and executes db-cli command |
| **Multi-database support** (MySQL + DAMENG/达梦) | Enterprise requirement in China - most tools only support MySQL | Medium | GORM abstraction enables this |
| **JSON as default output** | Machine-readable, easy to pipe to jq or other tools | Low | Most CLIs default to ASCII table |
| **Multiple output formats** (JSON/table/CSV) | Flexibility for different use cases | Low | `--format json|table|csv` |
| **Error codes with descriptions** | Faster debugging than generic error messages | Medium | Map MySQL/DAMENG error codes to human-readable messages |
| **Command history logging** (without sensitive data) | Audit trail, repeatable operations | Medium | Filter out passwords from logs |
| **Indexes and foreign keys in desc** | Full schema understanding in one command | Medium | Most tools show only columns |
| **DDL export** | Schema backup without data | Medium | `export --ddl` for CREATE TABLE statements |

## Anti-Features

Features to explicitly NOT build for db-cli.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Interactive REPL mode** | Adds complexity (readline, history management, session state); user explicitly prefers subcommand design | Pure subcommand architecture - each invocation is independent |
| **Environment/profile management** | Security risk if credentials stored; adds config file complexity | Require explicit connection params every time (or via environment variables if user prefers) |
| **Password storage** | Security liability - never store credentials | Accept via flag, env var, or prompt at runtime |
| **Built-in AI/LLM** | Bloats CLI, requires API key management, rapid obsolescence | Keep AI in Skill layer (Claude Code integration) |
| **CRUD interception/warnings** | Paternalistic design; user has the credentials they're using | Trust user's permissions - if they have DELETE access, let them DELETE |
| **GUI/TUI interface** | Scope creep; different skill set; terminal users prefer composability | Stay CLI-focused; output can be piped to other tools |
| **Connection pooling** | Designed for one-off commands, not long-running processes | Each invocation creates fresh connection |

## Feature Dependencies

```
Connection Parameters → SQL Execution → Output Formatting
                      ↓
Transaction Control → Error Handling → Exit Codes

SQL Execution → desc (uses SHOW COLUMNS/INFORMATION_SCHEMA)
              → export (uses SELECT + formatting)
              → import (uses file reading + SQL execution)

Natural Language (Skill) → db-cli command generation → SQL Execution
```

### Dependency Notes

- **Connection validation** must happen before any operation
- **Error handling** must wrap all execution paths (single SQL, file, import/export)
- **Output formatting** applies to all commands that produce results (exec, desc, export)
- **Transaction control** affects exec and import operations
- **Skill layer** depends on CLI having stable, predictable output (JSON preferred)

## Complexity Analysis

| Feature Category | Complexity | Reason |
|------------------|------------|--------|
| **Basic execution** | Low | GORM handles connection and query execution |
| **File operations** | Low-Medium | Go's ioutil/os packages handle file reading; error line tracking adds slight complexity |
| **Output formatting** | Low | Go's `encoding/json` for JSON; table libraries exist (olekukonko/tablewriter) |
| **Transaction control** | Medium | Need to manage GORM's transaction state; different behavior for MySQL vs DAMENG |
| **Error code mapping** | Medium | Need error code databases for both MySQL and DAMENG |
| **DESC command** | Medium | INFORMATION_SCHEMA queries vary between MySQL and DAMENG |
| **Export (INSERT generation)** | Medium-High | Need to iterate rows and generate proper INSERT syntax; handle escaping |
| **Export (DDL generation)** | High | Requires querying schema tables; DAMENG may have different metadata structure |
| **History logging** | Medium | Need to filter sensitive data; secure log storage |

## MVP Recommendation

**Phase 1 - Core Execution:**
1. Connection parameters via flags
2. `exec` - single SQL statement
3. `exec -f` - SQL file execution
4. Error handling with exit codes
5. JSON output (default)

**Phase 2 - Schema & Import/Export:**
1. `desc` - table structure (columns only)
2. `import` - SQL file import
3. `export` - data as INSERT statements

**Phase 3 - Polish & Differentiators:**
1. `desc` - indexes and foreign keys
2. `export --ddl` - DDL export
3. Multiple output formats (--format flag)
4. Command history logging
5. Error code descriptions

**Phase 4 - Skill Integration:**
1. Natural language → db-cli command translation
2. Install workflow (download from Releases)

## Competitive Analysis

| Feature | mysql CLI | mycli | pgcli | SQLite CLI | db-cli (planned) |
|---------|-----------|-------|-------|------------|------------------|
| Auto-completion | No | Yes | Yes | No | No (by design) |
| Syntax highlighting | No | Yes | Yes | No | No |
| Default output | ASCII table | ASCII table | ASCII table | ASCII table | JSON |
| Multiple formats | Limited | Yes | Yes | No | Yes (planned) |
| Single SQL exec | Yes | Yes | Yes | Yes | Yes |
| File execution | Yes (source) | Yes | Yes | Yes (.read) | Yes |
| Describe table | DESC | Yes | \d | .schema | Yes (enhanced) |
| Export | mysqldump (separate) | No | pg_dump (separate) | .dump | Yes (built-in) |
| Import | mysql < file.sql | Yes | Yes | .read | Yes |
| Transaction control | Yes | Yes | Yes | Yes | Yes (--autocommit) |
| Natural language | No | No | No | No | **Yes (Skill)** |
| Multi-database | No | MySQL only | PostgreSQL only | SQLite only | **MySQL + DAMENG** |

### Key Insight

Most database CLI tools are **REPL-focused** (interactive) with auto-completion and syntax highlighting. db-cli is **subcommand-focused** (scriptable, CI/CD friendly) with JSON-first output and natural language support via Skill layer. This is a deliberate differentiation.

## Sources

- [MySQL CLI features and usage patterns](https://dev.mysql.com/doc/refman/8.0/en/mysql.html)
- [mycli GitHub repository feature list](https://github.com/dbcli/mycli)
- [pgcli feature documentation](https://www.pgcli.com/)
- [SQLite CLI commands reference](https://sqlite.org/cli.html)
- Database CLI best practices from community discussions 2024-2025
