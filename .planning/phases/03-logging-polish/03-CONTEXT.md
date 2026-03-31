# Phase 3: Logging & Polish - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Users have command history and error logging for audit and debugging. Builds on Phase 1 & 2 exec/desc/export commands — adds transparent logging to `~/.db-cli/` directory for all executed commands and errors.

</domain>

<decisions>
## Implementation Decisions

### Command History Logging (LOG-01)
- **D-01:** Log to `~/.db-cli/history.log` — standard location for user-specific data
- **D-02:** Each log entry includes: timestamp, command name, flags (with passwords redacted), exit status
- **D-03:** Password redaction: replace `-p <password>` value with `***` before logging
- **D-04:** Log format: JSON lines for easy parsing — `{ "timestamp": "...", "command": "...", "args": [...], "exit_code": 0 }`
- **D-05:** Rotate log file at 10MB to prevent unbounded growth

### Error Logging (LOG-02)
- **D-06:** Log to `~/.db-cli/error.log` — separate file for errors (easier to grep)
- **D-07:** Each error entry includes: timestamp, command, error code, error message, stack trace (if available)
- **D-08:** Error format: JSON lines matching history.log structure
- **D-09:** Log rotation at 10MB (same as history)

### Integration Points
- **D-10:** Hook into PersistentPreRunE for command start logging
- **D-11:** Hook into RunE error returns for error logging
- **D-12:** Use defer pattern for guaranteed log flush on exit

### Log Retention
- **D-13:** Default retention: 30 days (configurable via environment variable)
- **D-14:** No log compression for MVP (can add later)

### Privacy & Security
- **D-15:** Never log actual password values — always redact
- **D-16:** Log file permissions: 0600 (owner read/write only)

### Code Reuse from Prior Phases
- **D-17:** Reuse `cmd/root.go` PersistentPreRunE hook
- **D-18:** Reuse `ExecutionError` type from error_handler.go
- **D-19:** Use standard library `encoding/json` and `os` packages

### Claude's Discretion
- Exact log file path (`~/.db-cli` vs `~/.config/db-cli`)
- Log rotation strategy (size-based vs time-based)
- Log entry field names and structure details

### Folded Todos
None — no pending todos to fold into scope.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 Requirements
- `.planning/REQUIREMENTS.md` — LOG-01, LOG-02 requirements
- `.planning/ROADMAP.md` — Phase 3 scope, success criteria, depends on Phase 2

### Phase 1 & 2 Context (Reuse Patterns)
- `.planning/phases/01-mysql-core-execution/01-CONTEXT.md` — Connection layer, CLI framework patterns
- `.planning/phases/01-mysql-core-execution/01-03-PLAN.md` — CLI root command, PersistentPreRunE hook
- `.planning/phases/01-mysql-core-execution/01-05-PLAN.md` — Error handler pattern

### External References
- Go `log` package — standard library logging
- Go `os.UserHomeDir()` — cross-platform home directory
- File permissions — `os.OpenFile` with `os.O_APPEND | os.O_CREATE | os.O_WRONLY`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cmd/root.go` — PersistentPreRunE hook for command start logging
- `cmd/error_handler.go` — ExecutionError type with line number tracking
- `cmd/exec.go` — RunE pattern with error returns
- `cmd/desc.go` — RunE pattern with error returns
- `cmd/export.go` — RunE pattern with error returns

### Established Patterns
- Command structure: `cmd/<command>.go` with `init()` and `<command>Cmd`
- Error handling: `RunE` returns error, Cobra handles exit code
- Password handling: `cfg.Password == "-"` for stdin reading

### Integration Points
- New logging package in `internal/logging/` or `internal/log/`
- Hook into rootCmd.PersistentPreRunE for command start
- Wrap command RunE functions or use cobra's middlewares
- Use defer for log flush on command completion

### Code Style
- GORM-first approach for all database operations
- JSON output format for machine readability
- Exit codes: 0 success, 1 error
- Structured types over raw maps
</code_context>

<specifics>
## Specific Ideas

- "History should be queryable" — maybe `db-cli history --last 10` in future
- "Error log like nginx error.log" — timestamp, level, message format
- "Password redaction like bash history" — but automatic and secure
- CI/CD friendly — logging can be disabled via `DB_CLI_NOLOG=1`

No specific visual/UI references — pure CLI tool.
</specifics>

<deferred>
## Deferred Ideas

### Phase 4 (Dameng & Skill)
- Dameng database full support with dm-go-driver/v2
- Claude Code Skill integration
- Skill auto-download from GitHub Releases

### v2 Backlog
- `db-cli history` command to view/query history
- Log compression for space efficiency
- Log export for audit compliance
- Structured log output (e.g., `--log-format=json` for external tools)
- Integration with external log aggregators (Splunk, ELK)

### Reviewed Todos (not folded)
None — no todos to review.
</deferred>

---

*Phase: 03-logging-polish*
*Context gathered: 2026-03-31*
