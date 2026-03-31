# Phase 1: MySQL Core Execution - Context

**Gathered:** 2026-03-31 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Working CLI with exec command, MySQL connection, JSON output, error handling. Phase 1 is MySQL-only foundation — Dameng support deferred to Phase 4.
</domain>

<decisions>
## Implementation Decisions

### CLI Framework
- **D-01:** Use Cobra framework for CLI structure
- **D-02:** Command organization: `cmd/root.go` (root), `cmd/exec.go` (exec command), `cmd/import.go` (import command)
- **D-03:** Root command handles global flags (host, port, user, password, database, type)

### Connection Handling
- **D-04:** Connection parameters via flags: `-h/--host`, `-P/--port`, `-u/--user`, `-p/--password`, `-d/--database`, `-t/--type`
- **D-05:** Password supports stdin reading via `--password=-` to avoid command-line exposure
- **D-06:** Database type flag: `-t mysql` (Phase 1), `-t dameng` (Phase 4)
- **D-07:** GORM DB connection initialized per command execution, closed after completion

### MySQL Driver
- **D-08:** Use `github.com/go-sql-driver/mysql@v1.9.3` — pure Go, no CGO
- **D-09:** GORM v1.30+ for ORM layer

### Dameng Driver (Phase 4 prep)
- **D-10:** Use official `dm-go-driver/v2` for DM8+ (per Dameng official docs)
- **D-11:** Dameng driver likely requires CGO — document platform-specific build steps
- **D-12:** Import path to be confirmed during Phase 4 planning (likely `github.com/dm-tech/dm-go-driver/v2` or similar)

### Command Design
- **D-13:** `exec` command: `db-cli exec [flags] '<SQL>'` or `db-cli exec [flags] --file=xxx.sql`
- **D-14:** `import` command: semantically clearer alias for `exec --file`, reuses same logic
- **D-15:** SQL file parsed and executed statement by statement

### Error Handling
- **D-16:** SQL file execution stops immediately on error
- **D-17:** Display error code and message on failure
- **D-18:** Return non-zero exit code on error

### Transaction Control
- **D-19:** `--autocommit=true` (default): each SQL auto-committed
- **D-20:** `--autocommit=false`: BEGIN/COMMIT/ROLLBACK within SQL file are honored

### Output Format
- **D-21:** Default output: JSON array (one object per row)
- **D-22:** `--format=table`: ASCII table output
- **D-23:** `--format=csv`: CSV output (default delimiter: comma)

### Build Strategy
- **D-24:** Single binary executable — no external dependencies (except Dameng CGO)
- **D-25:** Cross-platform: Windows (amd64/arm64), macOS (amd64/arm64), Linux (amd64/arm64)

### Claude's Discretion
- Logging implementation details (LOG-01/LOG-02 deferred to Phase 3)
- Exact progress bar implementation for large file imports
- Connection pool configuration (use GORM defaults per "Out of Scope")

### Folded Todos
None — no pending todos to fold into scope.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core CLI
- `.planning/REQUIREMENTS.md` — CONN-01, CONN-02, EXEC-01~04, DQL-01, IO-01, PLATFORM-01/02
- `.planning/PROJECT.md` — Design principles, "no config" constraint, GORM priority
- `.planning/ROADMAP.md` — Phase 1 scope, success criteria, dependencies

### Dameng Reference (Phase 4)
- Dameng official docs: https://eco.dameng.com/document/dm/zh-cn/app-dev/go_gorm.html — Go + GORM integration guide
- Community guide: https://www.yanwq.com/2024/04/10/go-through-gorm-dm-db/ — Practical examples

Phase 1 has no external specs — requirements fully captured in decisions above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — new project, no existing code.

### Established Patterns
None — new project, no established patterns.

### Integration Points
- Cobra root command → global flags → subcommands (exec, import)
- GORM initialization → SQL execution → output formatting → exit code

### Greenfield Opportunity
- All architecture decisions are flexible within requirement constraints
- No legacy patterns to work around
- Clean slate for establishing best practices
</code_context>

<specifics>
## Specific Ideas

- "I want it to feel like pg_dump/mysql — familiar to database people" (implied by CLI conventions)
- CI/CD friendly — no interactive prompts, clean exit codes
- Password security: `--password=-` for stdin reading to avoid shell history exposure

No specific visual/UI references — pure CLI tool.
</specifics>

<deferred>
## Deferred Ideas

### Phase 2 (Schema Inspection)
- DESC command: `desc --table=xxx`, `--indexes`, `--foreign-keys`, `--databases`, `--tables`
- Multiple output formats: table, CSV enhancements

### Phase 3 (Logging & Polish)
- Command history logging to `~/.db-cli/history.log`
- Error logging to `~/.db-cli/error.log`

### Phase 4 (Dameng & Skill)
- Dameng database support with dm-go-driver/v2
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

*Phase: 01-mysql-core-execution*
*Context gathered: 2026-03-31*
