# Phase 2: Schema Inspection & Import/Export - Context

**Gathered:** 2026-03-31 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can inspect database schema and export/import data. Builds on Phase 1 exec command infrastructure — adds desc command for schema inspection and export command for data export.

</domain>

<decisions>
## Implementation Decisions

### Command Design
- **D-01:** `desc` command: `db-cli desc [flags]` with sub-options
- **D-02:** `export` command: `db-cli export [flags] --query='SELECT...' --output=file.sql` or `--table=xxx`
- **D-03:** Reuse Phase 1 global connection flags (-h, -P, -u, -p, -d, -t)

### DESC Command Features
- **D-04:** `--table=xxx` shows table structure (fields, types, null, key, default, extra) — similar to MySQL `DESCRIBE`
- **D-05:** `--indexes` flag shows table index information
- **D-06:** `--foreign-keys` flag shows foreign key constraints
- **D-07:** `--databases` flag lists all databases
- **D-08:** `--tables` flag lists all tables in current database

### Export Command Features
- **D-09:** `--query='SELECT...'` exports query results to file
- **D-10:** `--table=xxx` exports entire table (structure + data)
- **D-11:** `--format=insert` generates `INSERT INTO table (cols) VALUES (vals);` statements
- **D-12:** `--format=ddl` generates `CREATE TABLE` statement

### Output Format Extensions
- **D-13:** `--format=table` uses ASCII table format (olekukonko/tablewriter or similar)
- **D-14:** `--format=csv` with `--csv-delimiter=,` flag (default: comma)
- **D-15:** Phase 1 JSON output remains default: `--format=json`

### Dameng Preparation (CONN-03)
- **D-16:** Add infrastructure for `-t dameng` but defer full implementation to Phase 4
- **D-17:** Connection layer already supports DBType switching (from Phase 1)

### Code Reuse from Phase 1
- **D-18:** Reuse `internal/database/connection.go` unchanged
- **D-19:** Extend `internal/output/json.go` for table/csv formatters
- **D-20:** Use same error handling pattern as exec command

### Claude's Discretion
- Exact table formatter library choice
- DESC output column order and formatting details
- Export file header/footer format (comments, timestamps)

### Folded Todos
None — no pending todos to fold into scope.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Requirements
- `.planning/REQUIREMENTS.md` — CONN-03, DQL-02, DESC-01~04, IO-02, IO-03
- `.planning/ROADMAP.md` — Phase 2 scope, success criteria, depends on Phase 1
- `.planning/PROJECT.md` — Design principles, "no config" constraint

### Phase 1 Context (Reuse Patterns)
- `.planning/phases/01-mysql-core-execution/01-CONTEXT.md` — Connection layer, CLI framework, output module decisions
- `.planning/phases/01-mysql-core-execution/01-02-PLAN.md` — Database connection implementation
- `.planning/phases/01-mysql-core-execution/01-04-PLAN.md` — Output formatter patterns

### External References
- MySQL `DESCRIBE` syntax: Standard table inspection format
- MySQL `SHOW DATABASES` / `SHOW TABLES`: Metadata queries
- GORM Migrator API: Schema introspection methods
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `internal/database/connection.go` — ConnectionConfig, BuildDSN, OpenConnection, CloseConnection (Phase 1 verified)
- `internal/output/json.go` — FormatJSON, ScanRows (Phase 1 verified)
- `cmd/root.go` — Global flags setup, PersistentPreRunE for password stdin
- `cmd/exec.go` — Command pattern with flag handling, error handling
- `cmd/error_handler.go` — ExecutionError with line number tracking

### Established Patterns
- Command structure: `cmd/<command>.go` with `init()` and `<command>Cmd`
- Output formatters in `internal/output/` package
- Database operations use `defer` for connection cleanup
- Error messages include context (what was doing, which line)

### Integration Points
- New `desc` command registers with rootCmd in Phase 1 structure
- New `export` command reuses exec's RunExecute pattern
- Table/CSV formatters extend `internal/output` package

### Code Style
- GORM-first approach for all database operations
- Flag naming consistency: short flags (-h, -P, -u, -p, -d, -t)
- Exit codes: 0 success, 1 error
</code_context>

<specifics>
## Specific Ideas

- "DESC output should feel like MySQL's `DESCRIBE table`" — familiar to database users
- "Export format like `mysqldump`" — industry standard reference
- CI/CD friendly — no interactive prompts, clean exit codes
- Password security: `--password=-` for stdin reading (Phase 1 pattern)

No specific visual/UI references — pure CLI tool.
</specifics>

<deferred>
## Deferred Ideas

### Phase 3 (Logging & Polish)
- Command history logging to `~/.db-cli/history.log`
- Error logging to `~/.db-cli/error.log`
- Enhanced error messages

### Phase 4 (Dameng & Skill)
- Dameng database full support with dm-go-driver/v2
- Claude Code Skill integration

### v2 Backlog
- PostgreSQL support
- SQLite support
- Batch mode from stdin
- Progress bar for large imports
- Parallel import
- Data masking for export
- SQL formatting/beautification

### Reviewed Todos (not folded)
None — no todos to review.
</deferred>

---

*Phase: 02-schema-inspection-import-export*
*Context gathered: 2026-03-31*
