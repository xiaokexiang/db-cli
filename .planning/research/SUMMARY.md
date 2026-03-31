# Project Research Summary

**Project:** db-cli
**Domain:** Go-based database CLI tool
**Researched:** 2026-03-31
**Confidence:** MEDIUM

## Executive Summary

db-cli is a Go-based command-line tool for database operations targeting MySQL and Dameng (达梦) databases. It follows a subcommand-focused architecture (similar to kubectl, gh) rather than interactive REPL design, making it suitable for scripting, CI/CD pipelines, and integration with natural language interfaces via a Skill layer.

The recommended approach uses Cobra for CLI framework, GORM for database abstraction, and official drivers for MySQL (go-sql-driver/mysql) and Dameng (dm-go-driver). The architecture separates concerns across CLI commands, database connection factory, SQL executor, and output formatters. JSON is the default output format for machine readability, with table and CSV as alternatives.

Key risks include: (1) SQL injection via dynamic query construction, (2) credential exposure in process lists and logs, (3) Dameng driver availability and CGO requirements complicating cross-platform builds, and (4) MySQL vs Dameng SQL dialect incompatibilities. Mitigation strategies include using parameterized queries, password prompting/redaction, and comprehensive testing against both databases.

## Key Findings

### Recommended Stack

**Core technologies:**
- **cobra v1.10.2**: CLI framework — industry standard used by kubectl, hugo, gh; provides subcommand support, automatic help generation, flag validation, bash completion
- **GORM v1.30+**: ORM layer — unified API across MySQL and Dameng, connection pooling, migration helpers
- **go-sql-driver/mysql v1.9.3**: MySQL driver — official driver, pure Go, actively maintained, supports MySQL 5.7-8.x
- **dm-go-driver**: Dameng driver — requires CGO and Dameng client libraries; import path needs verification (possibly `github.com/cherishlee/dm_go_driver`)
- **uber-go/zap or rs/zerolog**: Structured logging — for command history and error logging with performance

**Cross-platform build targets:** Windows (amd64/arm64), macOS (amd64/arm64), Linux (amd64/arm64). Dameng CGO requirements may complicate static binary distribution.

### Expected Features

**Must have (table stakes):**
- SQL execution (single statement and from file) — core functionality
- Connection parameters via flags (host/port/user/password/database) — every database tool needs this
- Query results display with JSON default format — machine-readable output
- Error reporting with exit codes — CI/CD integration
- Table structure view (DESCRIBE/DESC) — understanding schema without manual queries
- Transaction control (--autocommit flag) — data safety for destructive operations
- SQL import/export — loading dumps, migrations, backups

**Should have (competitive differentiators):**
- Natural language interface via Skill layer — users don't need SQL knowledge
- Multi-database support (MySQL + Dameng) — enterprise requirement in China
- Multiple output formats (JSON/table/CSV) — flexibility for different use cases
- Error codes with human-readable descriptions — faster debugging
- Command history logging (sanitized) — audit trail
- Enhanced DESC with indexes and foreign keys — full schema understanding
- DDL export capability — schema backup without data

**Defer (v2+):**
- Interactive REPL mode — explicitly avoided by design (adds complexity)
- Environment/profile management — security risk, prefer explicit params
- Built-in AI/LLM — keep in Skill layer, not CLI
- CRUD interception/warnings — paternalistic design, trust user permissions

### Architecture Approach

The architecture follows standard Go CLI patterns with clear component boundaries. The CLI layer (cmd/) handles flag parsing and routing only. The database/ package implements a connection factory supporting multiple database types. The executor/ package contains SQL execution logic with transaction management. The output/ package provides formatter interfaces (JSON/table/CSV). Error handling uses typed error codes for automation friendliness.

**Major components:**
1. **cmd/db-cli/** — entry point, Cobra bootstrap
2. **internal/cli/** — subcommand definitions (exec, desc, export, import)
3. **internal/database/** — connection factory, DSN building, GORM initialization
4. **internal/executor/** — SQL execution engine, file processing, transaction management
5. **internal/output/** — formatters (JSON default, table, CSV)
6. **internal/errors/** — error types and codes with human-readable messages
7. **internal/logger/** — structured logging and sanitized command history

**Data flow:** User Input → cmd/main → cli/* (flag parsing) → database/ (connection) → executor/ (SQL execution) → output/ (formatting) → stdout

### Critical Pitfalls

1. **SQL Injection via Dynamic Query Construction** — Always use parameterized queries with `?` placeholders; never use `fmt.Sprintf` with SQL keywords; leverage GORM's query builder

2. **Credential Exposure in Process Lists and Logs** — Use password prompting for interactive mode; never log full DSN/connection strings; redact passwords with regex before logging

3. **GORM N+1 Query Problem** — Use `Preload()` for eager loading; avoid loops that fetch related data; enable SQL logging to detect repeated queries

4. **Missing Connection Pool Configuration** — Explicitly configure `SetMaxIdleConns`, `SetMaxOpenConns`, `SetConnMaxLifetime`; defer `sql.DB.Close()` for cleanup

5. **Transaction Handling Without Proper Rollback** — Always use `defer tx.Rollback()` pattern; commit only after all operations succeed; handle panics in defer

**Additional noteworthy pitfalls:**
- Windows line endings (CRLF) breaking SQL import — normalize with `strings.ReplaceAll(content, "\r\n", "\n")`
- Path separator issues on Windows — use `filepath.Join()` instead of hardcoded `/`
- MySQL vs Dameng dialect incompatibility — test both databases; use dialect-aware identifier quoting
- Unhelpful error messages — wrap raw errors with actionable context for users

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Execution Foundation
**Rationale:** Foundation that all other features depend on; establishes safe patterns for SQL execution and connection handling
**Delivers:** Working CLI with exec command, connection handling, JSON output, error handling with exit codes
**Addresses:** SQL execution (single + file), connection parameters, error reporting, exit codes, JSON output default
**Avoids:** SQL injection (parameterized queries), credential exposure (password prompting/redaction), connection pool misconfiguration, unhelpful error messages
**Uses:** cobra v1.10.2, GORM v1.30+, go-sql-driver/mysql v1.9.3
**Implements:** Connection factory pattern, command-executor separation, error codes with context

### Phase 2: Schema Operations and Import/Export
**Rationale:** Builds on Phase 1 execution engine; adds data manipulation capabilities users expect
**Delivers:** desc command for table structure, import command for SQL files, export command for data dumps
**Addresses:** Table structure view, SQL import, SQL export (INSERT statements), enhanced DESC (indexes/foreign keys), DDL export
**Avoids:** Windows line ending issues (normalize input), path separator issues (filepath.Join), NULL type mismatches (use sql.Null* types)
**Uses:** GORM schema inspection, file I/O with cross-platform paths
**Implements:** SQL file parser with statement splitting, INSERT generation, schema metadata queries

### Phase 3: Polish and Differentiators
**Rationale:** Adds competitive features that distinguish db-cli from other database CLIs
**Delivers:** Multiple output formats, command history logging, error code descriptions, enhanced error handling
**Addresses:** Multiple output formats (--format flag), command history logging (sanitized), error codes with descriptions
**Avoids:** Transaction rollback failures (defer pattern), N+1 queries (eager loading), timezone handling issues
**Uses:** zap/zerolog for logging, table/CSV formatter libraries
**Implements:** Formatter interface with multiple implementations, sanitized history logging

### Phase 4: Dameng Support and Skill Integration
**Rationale:** Adds multi-database support and natural language interface; requires validation of Dameng driver
**Delivers:** Dameng database support, natural language to db-cli command translation
**Addresses:** Multi-database support (MySQL + Dameng), natural language interface via Skill layer
**Avoids:** MySQL vs Dameng dialect incompatibility (test both, dialect-aware quoting)
**Uses:** dm-go-driver (CGO considerations), GORM multi-dialect support
**Implements:** Database type detection, dialect-specific DSN building, Skill layer command generation

### Phase Ordering Rationale

- **Foundation first:** Phase 1 establishes safe patterns (parameterized queries, credential handling, error wrapping) that all subsequent phases inherit
- **Dependency chain:** Schema operations (Phase 2) require working connection and execution from Phase 1; export/import need executor and formatter infrastructure
- **Risk mitigation:** Dameng support deferred to Phase 4 due to LOW confidence in driver availability and CGO build complexity; MySQL-first approach de-risks initial development
- **Competitive features last:** Differentiators (Phase 3-4) require stable foundation; natural language interface depends on predictable CLI output (JSON)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Dameng Support):** Dameng Go driver availability, import path, CGO requirements, and GORM compatibility need hands-on validation; DSN format for Dameng differs from MySQL
- **Phase 2 (Export DDL):** DDL generation may require database-specific metadata queries; Dameng information schema structure needs verification

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Core Execution):** Well-documented patterns from Cobra, GORM, and Go database best practices; HIGH confidence sources
- **Phase 3 (Polish):** Output formatting, logging, and error handling are standard CLI concerns with extensive community knowledge

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Cobra and MySQL driver HIGH confidence; Dameng driver LOW confidence (requires validation) |
| Features | HIGH | Based on competitive analysis of mysql CLI, mycli, pgcli, SQLite CLI; clear table stakes identified |
| Architecture | HIGH | Follows golang-standards/project-layout and established CLI patterns (kubectl, gh, cobra examples) |
| Pitfalls | MEDIUM | Security and GORM pitfalls HIGH confidence; Dameng-specific issues LOW confidence |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Dameng driver availability:** Need to verify `dm-go-driver` or `dm8_go_driver` exists on GitHub, confirm import path, and test CGO requirements during Phase 4 planning
- **Dameng DSN format:** Connection string format for Dameng differs from MySQL; requires driver documentation or hands-on testing
- **GORM + Dameng compatibility:** Some GORM features may not work with Dameng; raw SQL fallback may be needed for DDL operations
- **Cross-platform CGO builds:** If Dameng driver requires CGO, static binary distribution becomes complex; may need platform-specific build documentation
- **Dameng error codes:** Error code mapping for user-friendly messages requires Dameng error documentation (limited English resources)

## Sources

### Primary (HIGH confidence)
- **Cobra v1.10.2 Release** — https://github.com/spf13/cobra/releases/tag/v1.10.2 — CLI framework selection rationale
- **go-sql-driver/mysql v1.9.3** — https://github.com/go-sql-driver/mysql/releases/tag/v1.9.3 — MySQL driver selection
- **GORM Documentation** — https://gorm.io — ORM patterns, connection pooling, transaction handling
- **golang-standards/project-layout** — https://github.com/golang-standards/project-layout — Go project structure
- **OWASP SQL Injection Prevention** — https://owasp.org/www-community/attacks/SQL_Injection — Security patterns

### Secondary (MEDIUM confidence)
- **mycli GitHub repository** — https://github.com/dbcli/mycli — Feature comparison, table stakes identification
- **pgcli documentation** — https://www.pgcli.com — Feature comparison
- **SQLite CLI reference** — https://sqlite.org/cli.html — Feature comparison
- **Go Database Best Practices** — https://github.com/golang/go/wiki/SQLDrivers — Connection pooling, error handling
- **MySQL CLI documentation** — https://dev.mysql.com/doc/refman/8.0/en/mysql.html — Expected features

### Tertiary (LOW confidence)
- **Dameng driver availability** — https://github.com/cherishlee/dm_go_driver — Requires verification; import path uncertain
- **Dameng Database Documentation** — http://www.dameng.com.cn/ — Limited English documentation; dialect differences need validation
- **urfave/cli v3.8.0** — https://github.com/urfave/cli/releases/tag/v3.8.0 — Alternative considered

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
