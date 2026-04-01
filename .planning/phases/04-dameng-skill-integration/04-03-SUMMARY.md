---
phase: 04-dameng-skill-integration
plan: 03
subsystem: skill-mcp-server
tags:
  - mcp
  - skill
  - tools
  - template-matching
dependency_graph:
  provides:
    - SKILL-01: Natural language to db-cli command conversion
  requires:
    - db-cli binary at ~/.db-cli/bin/db-cli
  affects:
    - Claude Code Skill workflow
tech_stack:
  added:
    - execa@latest - Process execution for delegating to db-cli
  patterns:
    - Zod schema validation for tool parameters
    - Template-based natural language parsing
    - MCP SDK tool registration
key_files:
  created:
    - path: db-cli-skill/src/templates/commands.ts
      purpose: Natural language command templates for 5 tools
    - path: db-cli-skill/src/templates/matcher.ts
      purpose: Template matching engine with confidence scoring
    - path: db-cli-skill/src/tools/count.ts
      purpose: Count rows tool with execa delegation
    - path: db-cli-skill/src/tools/desc.ts
      purpose: Table schema inspection tool
    - path: db-cli-skill/src/tools/export.ts
      purpose: Data export to file tool
    - path: db-cli-skill/src/tools/import.ts
      purpose: SQL file import tool
    - path: db-cli-skill/src/tools/exec.ts
      purpose: Arbitrary SQL execution tool
    - path: db-cli-skill/src/server/mcp-server.ts
      purpose: MCP server with all tools registered
  modified:
    - path: db-cli-skill/src/index.ts
      purpose: Updated to use createMcpServer from mcp-server.ts
    - path: db-cli-skill/tsconfig.json
      purpose: Include templates and tools directories
decisions:
  - name: Template matching over LLM SQL generation
    rationale: More controllable, predictable, and safer
  - name: Use exec() instead of match() for regex
    rationale: Properly captures groups with global flag patterns
  - name: Non-capturing groups for command words
    rationale: Simplifies extractParams logic
  - name: Each tool delegates to db-cli binary
    rationale: Single source of truth for database operations
metrics:
  duration: ~45 min
  completed: 2026-04-01
  tasks: 7
  files_created: 8
  files_modified: 2
---

# Phase 04 Plan 03: Skill Tools Implementation Summary

## One-liner

Implemented 5 MCP tools (count, desc, export, import, exec) with template-based natural language parsing, delegating all database operations to the db-cli binary.

## Overview

This plan completes the Skill MCP server implementation by:
1. Creating a template matching system for natural language parsing (D-09, D-10)
2. Implementing 5 tools that delegate to db-cli binary
3. Registering all tools with the MCP server
4. Ensuring TypeScript compiles without errors

## Tool Implementations

### count tool
- **Purpose:** Count rows in a database table
- **Schema:** host, port, user, password, database, table, where (optional), type
- **SQL:** `SELECT COUNT(*) FROM {table} {WHERE clause}`
- **Output:** Human-readable count message

### desc tool
- **Purpose:** Describe table structure
- **Schema:** host, port, user, password, database, table, indexes (optional), foreignKeys (optional), type
- **Delegates to:** `db-cli desc --table={table}`
- **Output:** Formatted table structure

### export tool
- **Purpose:** Export table data or query results to file
- **Schema:** host, port, user, password, database, table (optional), query (optional), output, format, type
- **Validation:** Either table or query must be provided
- **Formats:** insert, ddl, csv, json
- **Delegates to:** `db-cli export --table={table} --output={file} --format={format}`

### import tool
- **Purpose:** Import SQL file into database
- **Schema:** host, port, user, password, database, file, type
- **Validation:** File must exist
- **Delegates to:** `db-cli import --file={file}`
- **Output:** Rows affected / tables imported count

### exec tool
- **Purpose:** Execute arbitrary SQL statements
- **Schema:** host, port, user, password, database, sql, type
- **Warning:** Executes any SQL - use with caution
- **Delegates to:** `db-cli exec {sql}`
- **Output:** Formatted results (JSON for SELECT, status for others)

## Template Patterns

### count templates
- "How many rows in table X?"
- "Count records from X"
- "What is the count of X table"
- "Total rows in X"

### desc templates
- "Show (me) (the) structure of table X"
- "Describe table X"
- "What columns are in table X"
- "Table X structure"
- "Show (me) (the) indexes/foreign keys of table X"

### export templates
- "Export table X to file Y"
- "Backup/Dump/Save table X"
- "Export data from/of table X"
- "Download table X as CSV/SQL/JSON"
- "Export query: SELECT..."

### import templates
- "Import SQL file X"
- "Load data from file X"
- "Run/Execute SQL file X"
- "Restore table X from file Y"

### exec templates
- "Run SQL: {sql}"
- "Execute: {sql}"
- "{SELECT...}" (direct SQL statements)
- "Query: {sql}"

## Template Matcher

**Location:** `src/templates/matcher.ts`

**Key functions:**
- `getAllTemplates()` - Returns all CommandTemplate[]
- `matchUserIntent(input: string)` - Matches input against templates, returns MatchResult
- `getTemplateByName(name: string)` - Get specific template
- `validateParams(params, required)` - Check for missing required params

**MatchResult interface:**
```typescript
{
  tool: string;           // Tool name to call
  params: Record<string, string>; // Extracted parameters
  confidence: number;     // 0-1 confidence score
  missingParams: string[]; // Required but missing params
  patternIndex: number;   // Which pattern matched
}
```

**Confidence calculation:**
- Starts at 1.0
- -0.3 per missing required param
- +0.1 if match covers >80% of input
- -0.2 if match covers <30% of input
- +0.05 if match starts at beginning of input

## Integration Tests

All tests pass:
```
how many rows in users?          → count, table=users
describe table account           → desc, table=account
show me the structure of users   → desc, table=users
export table users to backup.sql → export, table=users, output=backup.sql
import migration.sql             → import, file=migration.sql
SELECT * FROM users WHERE...     → exec, sql=SELECT * FROM users WHERE...
run SQL: SELECT * FROM users     → exec, sql=SELECT * FROM users
```

## Build Verification

```bash
cd db-cli-skill && npm run build
# TypeScript compiles without errors

# Server starts with all 5 tools registered
node dist/index.js
# McpServer with tools: count, desc, export, import, exec
```

## Known Stubs

None - all functionality implemented and working.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript tsconfig excluded templates directory**
- **Found during:** Task 0 build
- **Issue:** `tsconfig.json` had `"exclude": ["src/templates"]` preventing compilation
- **Fix:** Updated include to explicitly list source directories
- **Files modified:** `db-cli-skill/tsconfig.json`

**2. [Rule 1 - Bug] Regex capture groups not working with String.match()**
- **Found during:** Task 0 testing
- **Issue:** `String.match()` with global regex doesn't return capture groups
- **Fix:** Changed `matcher.ts` to use `RegExp.exec()` instead
- **Files modified:** `db-cli-skill/src/templates/matcher.ts`

**3. [Rule 1 - Bug] Export pattern extractParams confused by filename containing keyword**
- **Found during:** Task 0 testing
- **Issue:** "backup.sql" contains "backup", causing wrong branch in extractParams
- **Fix:** Used regex test `/^(backup|dump|save)\b/i` to check start of string
- **Files modified:** `db-cli-skill/src/templates/commands.ts`

**4. [Rule 1 - Bug] Desc pattern didn't handle "show me the structure"**
- **Found during:** Task 0 testing
- **Issue:** Pattern expected "show structure" but input had filler words
- **Fix:** Added `(?:me\s+)?(?:the\s+)?` to pattern
- **Files modified:** `db-cli-skill/src/templates/commands.ts`

**5. [Rule 1 - Bug] Exec pattern only captured first word of SQL**
- **Found during:** Task 0 testing
- **Issue:** Pattern `(SELECT|INSERT|...)` only captured keyword
- **Fix:** Changed to `(.+)` capture group for full statement
- **Files modified:** `db-cli-skill/src/templates/commands.ts`

## Dependencies Installed

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0",
    "execa": "^9.0.0"
  }
}
```

## Success Criteria Met

- [x] SKILL-01 satisfied: All 5 tools implemented and registered
- [x] Template matching (D-09) parses natural language to tool + params
- [x] Each tool delegates to db-cli binary (not re-implementing SQL)
- [x] TypeScript compiles without errors
- [x] Tools accept connection params: host, database, user, password
- [x] Interactive guidance ready (D-11): missing params detected by matcher
