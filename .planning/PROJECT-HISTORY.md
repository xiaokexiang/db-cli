# Project History - Change Log Summary

This document maps the user-facing changes from `CHANGELOG.md` to the GSD planning phases and provides historical context for future development.

---

## Phase 05: CLI Simplification & Modernization (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - CLI 精简和现代化"

### Commands Removed
| Command | Reason | Replacement |
|---------|--------|-------------|
| `ping` | Redundant - connection now checked automatically before command execution | N/A |
| `history` | Consolidated for better UX | `logs --type=history` |
| `errors` | Consolidated for better UX | `logs --type=errors` |

### Command Changes

#### `exec`
- **Removed:** `--file` / `-f` flag (moved to `import` command)
- **Added:** Multi-line SQL support (semicolon delimited)
- **Changed:** Default output format from `json` to `table`
- **Added:** `--format=sql` for generating INSERT statements

**Rationale:** Separation of concerns - `exec` for inline SQL, `import` for file-based operations.

#### `import`
- **Changed:** Only supports `-f` / `--file` flag for file import
- **Added:** `.json` format support (auto-generates INSERT statements)
- **Supported formats:** `.sql`, `.json`

**Rationale:** Clear mental model - import always reads from files.

#### `export`
- **Removed:** `--format` flag
- **Changed:** Format auto-detected from output file extension
- **Removed:** Terminal output mode (must specify output file)
- **Supported formats:** `.sql` (CREATE + INSERT), `.json`

**Rationale:** Convention over configuration - file extension determines format.

#### `logs` (NEW)
- **Merged:** `history` + `errors` commands
- **Added:** `--type` flag for filtering (all/history/errors)

**Rationale:** Unified logging interface reduces command surface area.

### Final Command Structure (6 commands)
| Command | Description |
|---------|-------------|
| `version` | Print version information |
| `desc` | View table schema |
| `exec` | Execute SQL (multi-line, 3 output formats) |
| `import` | Import from file (.sql/.json) |
| `export` | Export to file (.sql/.json) |
| `logs` | View history and errors |

**Related Planning Files:**
- `.planning/phases/05-cli-simplification/05-SUMMARY.md`

---

## Phase 04: Dameng Database Support (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - 达梦数据库支持"

### New Features
- `export` command supports Dameng database
- `desc` command supports Dameng database
- Uses Dameng system views: `USER_TAB_COLUMNS`, `USER_INDEXES`, `USER_CONSTRAINTS`, etc.

### Technical Implementation
- Dameng dialect detection in `internal/database/schema.go`
- Custom SQL queries for Dameng system tables
- Double-quote identifier quoting (vs MySQL backticks)

**Related Planning Files:**
- `.planning/phases/04-dameng-skill-integration/`

---

## Phase 03: Logging & Polish (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - CLI 精简和现代化" (logs command)

### Changes
- Merged `history` and `errors` into unified `logs` command
- Added `--type` flag (all/history/errors)
- Added `--format=json` support
- Added `--last/-n` flag for limiting results

**Related Planning Files:**
- `.planning/phases/03-logging-polish/`

---

## Phase 02: Schema Inspection & Import/Export (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - CLI 精简和现代化" (export/import changes)

### Changes
- Export format auto-detection from file extension
- Import supports both `.sql` and `.json` formats
- JSON import auto-generates INSERT statements

**Related Planning Files:**
- `.planning/phases/02-schema-inspection-import-export/`

---

## Phase 01: MySQL Core Execution (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - 密码特殊字符支持"

### Bug Fixes
- `BuildDSN` now uses `url.QueryEscape()` for password encoding
- Supports special characters in passwords: `@`, `:`, `/`, etc.
- Users no longer need to manually URL-encode passwords

**Related Planning Files:**
- `.planning/phases/01-mysql-core-execution/`

---

## Integration Testing & Bug Fixes (2026-04-01)

**Corresponds to:** `CHANGELOG.md` section "[2026-04-01] - 集成测试和 Bug 修复"

### Bug Fixes

| Component | Issue | Fix |
|-----------|-------|-----|
| `export` | SQL export failed for expressions like `SELECT 1` (column name `1` is not valid identifier) | Quote column names with backticks/double quotes |
| `export` | Timestamp format was Go's `time.Time` string representation | Changed to SQL format `YYYY-MM-DD HH:MM:SS` |
| `export` | Dameng export used MySQL backticks | Dameng now uses double quotes |
| `export` | Dameng column types lacked length (e.g., `VARCHAR` instead of `VARCHAR(50)`) | Fixed query to include length |
| `import` | JSON ISO 8601 timestamps incompatible with Dameng | Auto-convert to SQL timestamp format |
| `import` | Dameng JSON import used backticks | Now uses double quotes |
| `schema` | Dameng query returned inconsistent column name casing | Now统一 returns `Field`, `Type`, etc. |

### New Features
- **exec:** `--format=sql` now supports Dameng (generates INSERT with double quotes)
- **export:** Full Dameng support (DDL + INSERT)
- **import:** Full Dameng JSON import support

### Documentation Updates
- **README.md:** Updated all command examples with MySQL and Dameng variants
- **README.md:** Added test environment database connection info

### Test Environment
- **MySQL:** `mysql://root:123456@10.50.8.44:3306/mysql`
- **Dameng:** `dameng://SYSDBA:SYSDBA001@10.50.8.44:5236`

---

## Timeline Summary

| Date | Phase | Focus | Status |
|------|-------|-------|--------|
| 2026-04-01 | Phase 01 | MySQL Core + Password Encoding | ✅ Complete |
| 2026-04-01 | Phase 02 | Schema Inspection + Import/Export | ✅ Complete |
| 2026-04-01 | Phase 03 | Logging Polish | ✅ Complete |
| 2026-04-01 | Phase 04 | Dameng Integration | ✅ Complete |
| 2026-04-01 | Phase 05 | CLI Simplification | ✅ Complete |
| 2026-04-01 | Integration | Full Testing + Bug Fixes | ✅ Complete |

---

## Document Maintenance

This file should be updated when:
1. A new phase completes in the GSD planning system
2. CHANGELOG.md is updated with user-facing changes
3. Major bug fixes or features are added

**Purpose:** Bridge the gap between user-facing changelog and developer-focused planning documents.
