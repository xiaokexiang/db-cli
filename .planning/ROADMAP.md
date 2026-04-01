# db-cli Roadmap

**Generated:** 2026-03-31
**Granularity:** standard
**Total Phases:** 4

---

## Phases

- [ ] **Phase 1: MySQL Core Execution** — Working CLI with exec command, MySQL connection, JSON output, error handling
- [ ] **Phase 2: Schema Inspection & Import/Export** — desc command, import/export commands, multiple output formats
- [ ] **Phase 3: Logging & Polish** — Command history, error logging, enhanced error messages
- [ ] **Phase 4: Dameng & Skill Integration** — Dameng database support, Claude Code Skill integration

---

## Phase Details

### Phase 1: MySQL Core Execution

**Goal:** Users can execute SQL statements against MySQL databases with proper error handling and JSON output

**Depends on:** Nothing (foundation phase)

**Requirements:**
- CONN-01: 支持通过 flag 指定数据库连接参数
- CONN-02: MySQL 数据库连接
- EXEC-01: 执行单条 SQL 语句
- EXEC-02: 执行 SQL 文件
- EXEC-03: 错误处理
- EXEC-04: 事务控制
- DQL-01: JSON 格式输出
- IO-01: 导入 SQL 文件 (等价于 exec --file)
- PLATFORM-01: 跨平台编译
- PLATFORM-02: 单一二进制

**Success Criteria** (what must be TRUE):
1. User can connect to MySQL database using flags (-h, -P, -u, -p, -d, -t mysql)
2. User can execute single SQL statement: `db-cli exec -h ... -u ... -p ... -d ... 'SELECT * FROM table'`
3. User can execute SQL file: `db-cli exec -h ... -u ... -p ... -d ... --file=script.sql`
4. SQL file execution stops on error with non-zero exit code and error message
5. Query results output as JSON array (one object per row)

**Plans:** 5 plans

Plans:
- [x] 01-01-PLAN.md — Project Setup & Dependencies (go.mod, .gitignore, Makefile)
- [x] 01-02-PLAN.md — Database Connection Layer (GORM + MySQL DSN)
- [x] 01-03-PLAN.md — CLI Root Command (Cobra flags, version cmd)
- [x] 01-04-PLAN.md — Exec Command (SQL execution, JSON output)
- [x] 01-05-PLAN.md — Error Handling, Transactions, Import Command (exit codes, rollback, D-14)

---

### Phase 2: Schema Inspection & Import/Export

**Goal:** Users can inspect database schema and export/import data

**Depends on:** Phase 1

**Requirements:**
- CONN-03: 达梦数据库连接 (prepare for Dameng, may defer full support)
- DQL-02: 多格式支持 (table, CSV)
- DESC-01: 查看表结构
- DESC-02: 查看索引
- DESC-03: 查看外键
- DESC-04: 查看元数据 (databases, tables)
- IO-02: 导出查询结果 (INSERT, DDL)
- IO-03: 导出整表

**Success Criteria** (what must be TRUE):
1. User can view table structure: `db-cli desc -h ... -u ... -p ... -d ... --table=xxx`
2. User can view indexes: `db-cli desc -h ... --table=xxx --indexes`
3. User can view foreign keys: `db-cli desc -h ... --table=xxx --foreign-keys`
4. User can list databases and tables: `db-cli desc -h ... --databases` / `--tables`
5. User can export query to file: `db-cli export -h ... --query='SELECT...' --output=file.sql`
6. User can export entire table with structure and data
7. User can change output format: `--format=table` or `--format=csv`

**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Table and CSV output formatters (DQL-02)
- [ ] 02-02-PLAN.md — desc command for schema inspection (DESC-01~04, CONN-03)
- [ ] 02-03-PLAN.md — export command for data export (IO-02, IO-03)

**UI hint:** yes

---

### Phase 3: Logging & Polish

**Goal:** Users have command history and error logging for audit and debugging

**Depends on:** Phase 2

**Requirements:**
- LOG-01: 命令历史
- LOG-02: 错误日志

**Success Criteria** (what must be TRUE):
1. Executed commands are logged to `~/.db-cli/history.log` (passwords redacted as `***`)
2. Errors are logged to `~/.db-cli/error.log` with timestamp, command, error code, and message
3. User can review command history for audit purposes

**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Logging infrastructure (history.log, error.log, password redaction)
- [ ] 03-02-PLAN.md — history and errors commands (view logs with --last, --format flags)

---

### Phase 4: Dameng & Skill Integration

**Goal:** Users can connect to Dameng databases and use natural language via Claude Code Skill

**Depends on:** Phase 3

**Requirements:**
- CONN-03: 达梦数据库连接（使用 GORM + dm-go-driver）
- SKILL-01: Claude Code Skill (natural language to db-cli command)
- SKILL-02: 自动下载 (Skill installs db-cli from GitHub Releases)

**Success Criteria** (what must be TRUE):
1. User can connect to Dameng database: `db-cli exec -t dameng -h ... -u ... -p ... -d ... 'SELECT...'`
2. Claude Code Skill can parse natural language and generate db-cli commands
3. Skill installation automatically downloads db-cli binary from GitHub Releases

**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md — Dameng driver integration (CONN-03, DSN builder, GORM connection)
- [ ] 04-02-PLAN.md — Skill MCP server foundation (project structure, binary path management)
- [ ] 04-03-PLAN.md — Skill tools implementation (count, desc, export, import, exec with template matching)
- [ ] 04-04-PLAN.md — Skill installer and GitHub Actions (auto-download from Releases, CI/CD)

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 1 | Pending |
| CONN-02 | Phase 1 | Pending |
| CONN-03 | Phase 4 | Complete |
| EXEC-01 | Phase 1 | Pending |
| EXEC-02 | Phase 1 | Pending |
| EXEC-03 | Phase 1 | Pending |
| EXEC-04 | Phase 1 | Pending |
| DQL-01 | Phase 1 | Pending |
| DQL-02 | Phase 2 | Pending |
| DESC-01 | Phase 2 | Pending |
| DESC-02 | Phase 2 | Pending |
| DESC-03 | Phase 2 | Pending |
| DESC-04 | Phase 2 | Pending |
| IO-01 | Phase 1 | Pending |
| IO-02 | Phase 2 | Pending |
| IO-03 | Phase 2 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| SKILL-01 | Phase 4 | Pending |
| SKILL-02 | Phase 4 | Pending |
| PLATFORM-01 | Phase 1 | Pending |
| PLATFORM-02 | Phase 1 | Pending |

**Coverage:** 22/22 requirements mapped ✓

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MySQL Core Execution | 5/5 | Complete | 01-01: Project Setup ✓, 01-02: Connection Layer ✓, 01-03: CLI Root Command ✓, 01-04: Exec Command ✓, 01-05: Error Handling, Transactions, Import ✓ |
| 2. Schema Inspection & Import/Export | 3/3 | Complete | 02-01: Table/CSV Formatters ✓, 02-02: Desc Command ✓, 02-03: Export Command ✓ |
| 3. Logging & Polish | 0/2 | Planned | - |
| 4. Dameng & Skill Integration | 1/4 | In progress | 04-01: Dameng Driver Integration ✓ |

---

## Notes

**Phase Ordering Rationale:**
- **Phase 1 (Foundation):** MySQL-only MVP avoids CGO/Dameng complexity initially; establishes safe patterns for SQL execution, connection handling, and error reporting
- **Phase 2 (Features):** Builds on Phase 1 executor; adds schema inspection and data manipulation capabilities
- **Phase 3 (Polish):** Logging requires stable command execution; adds audit trail for enterprise use
- **Phase 4 (Extension):** Dameng support deferred due to driver uncertainty; Skill integration requires stable CLI output format

**Risk Mitigation:**
- Dameng driver (dm-go-driver) needs validation during Phase 2 planning; may require fallback strategy
- CGO requirements for Dameng may complicate cross-platform builds; document platform-specific steps
- CONN-03 (Dameng connection) placed in Phase 2 to allow driver validation before full integration

---

## Phase 4 Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| Wave 1 | 04-01, 04-02 | Dameng driver (Go) + Skill foundation (TypeScript) — independent, parallel |
| Wave 2 | 04-03, 04-04 | Skill tools + Installer — depend on Wave 1 foundations |

---

*Last updated: 2026-03-31 - Phase 4 planned*
