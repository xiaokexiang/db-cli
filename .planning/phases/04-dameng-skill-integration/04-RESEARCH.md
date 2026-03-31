# Phase 4: Dameng & Skill Integration - Research

**Researched:** 2026-03-31
**Domain:** Dameng database Go driver integration, Claude Code Skill development, GitHub Releases binary distribution
**Confidence:** MEDIUM (network restrictions limited access to latest documentation)

## Summary

This phase implements two major capabilities: (1) Dameng DM8 database support via GORM, and (2) a Claude Code Skill that allows natural language database operations. The Dameng integration requires selecting an appropriate Go driver (likely CGO-based), while the Skill component involves creating an MCP server with template-based command parsing.

**Primary recommendation:** Use `gorm.io/driver/dm` if available (official GORM dialect), otherwise use `github.com/cherishlee/dm-go-driver` with CGO build documentation. For the Skill, implement as an MCP server using `modelcontextprotocol/go-sdk` with template matching for command parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 优先调研纯 Go 驱动方案（无需 CGO，构建简单）
- **D-02:** 如果纯 Go 驱动不可用，提供 CGO 构建方案和各平台指南
- **D-03:** 具体驱动选型留到 research 阶段决定，不提前锁定
- **D-04:** 统一 flag 设计：`db-cli exec -t dameng -h ... -u ... -p ... -d ... 'SQL'`
- **D-05:** 仅在与 MySQL 有差异时，为 dameng 添加额外专用 flag
- **D-06:** Skill 为独立仓库（db-cli-skill），独立版本控制
- **D-07:** Skill 安装时自动从 GitHub Releases 下载最新 db-cli 二进制
- **D-08:** 精简命令集：count、desc、export、import、exec
- **D-09:** 采用模板匹配方式：自然语言 → 匹配预定义命令模板 → 填充参数生成 db-cli 命令
- **D-10:** 模板匹配优于 LLM 直接生成 SQL，更可控、可预测、安全
- **D-11:** 交互式引导：Skill 检测到缺失必需参数时，逐个询问用户
- **D-12:** 更新机制：手动更新，不自动检查
- **D-13:** 使用 GitHub Actions CI/CD 自动构建并发布到 GitHub Releases

### Claude's Discretion
- 达梦驱动的具体选型和验证
- Skill 的具体实现架构和代码组织
- 模板匹配的具体算法和规则设计
- 发布流程的具体配置

### Deferred Ideas (OUT OF SCOPE)
- 达梦驱动的具体选型和验证 — research 阶段决定
- 丰富的快捷命令集（list、show、create、drop 等）— 后续阶段扩展
- Skill 自动检查更新 — 暂不需要，手动更新即可
- 版本管理功能 — 暂不需要
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CONN-03** | 支持达梦数据库连接（使用 GORM + dm-go-driver）— Phase 4 | Research identifies driver options, DSN format, CGO requirements, and GORM integration pattern |
| **SKILL-01** | Claude Code Skill 支持自然语言解析为 db-cli 命令 — Phase 4 | Research covers MCP server SDK, template matching approach, command definition patterns |
| **SKILL-02** | Skill 安装时自动从 GitHub Releases 下载 db-cli — Phase 4 | Research identifies GitHub release download libraries, version detection, binary path management |
</phase_requirements>

## Standard Stack

### Core - Dameng Driver
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **gorm.io/driver/dm** | Latest (TBD) | Official GORM dialect for Dameng | If available, provides seamless GORM integration with unified API |
| **github.com/cherishlee/dm-go-driver** | Latest | Dameng DM8 Go driver | Alternative if official GORM dialect unavailable; wraps Dameng C client |
| **golang.org/x/sys** | Latest | CGO helpers (if needed) | Required for CGO-based drivers on Windows |

### Core - MCP Server
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **github.com/modelcontextprotocol/go-sdk** | Latest | MCP server SDK | Official Go SDK for Model Context Protocol; tool definition, resource handling |
| **github.com/mark3labs/mcp-go** | Latest | Alternative MCP framework | Community-driven, may have simpler API for basic servers |

### Supporting - GitHub Releases
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **github.com/google/go-github/v68** | v68+ | GitHub API client | For release enumeration, asset download, version checking |
| **github.com/mholt/archiver/v4** | v4+ | Archive extraction | Extract downloaded .zip/.tar.gz releases |

### Supporting - Template Matching
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **github.com/leekchan/timeutil** | Latest | Time parsing helpers | For natural language date expressions |
| **regexp (stdlib)** | - | Pattern matching | Template pattern definition and matching |

**Installation:**
```bash
# Dameng driver (verify import path)
go get gorm.io/driver/dm@latest
# OR
go get github.com/cherishlee/dm-go-driver@latest

# MCP server SDK
go get github.com/modelcontextprotocol/go-sdk@latest

# GitHub API client
go get github.com/google/go-github/v68@latest
```

**Version verification:** Versions above are estimates based on typical Go library patterns. Verify with:
```bash
go get gorm.io/driver/dm@latest
go get github.com/modelcontextprotocol/go-sdk@latest
go get github.com/google/go-github/v68@latest
```

## Architecture Patterns

### Recommended Project Structure

**db-cli (main repository):**
```
.
├── cmd/
│   ├── root.go              # Root command with persistent flags
│   ├── exec.go              # exec command (extended for dameng)
│   ├── desc.go              # desc command
│   └── export.go            # export command
├── internal/
│   ├── database/
│   │   ├── connection.go    # GORM connection factory (extend for dameng)
│   │   └── schema.go        # Schema inspection helpers
│   ├── output/
│   │   ├── json.go
│   │   ├── table.go
│   │   ├── csv.go
│   │   ├── insert.go
│   │   └── ddl.go
│   └── logging/
│       ├── logger.go
│       └── reader.go
└── main.go
```

**db-cli-skill (separate repository):**
```
db-cli-skill/
├── src/
│   ├── index.ts             # MCP server entry point
│   ├── tools/
│   │   ├── count.ts         # count rows tool
│   │   ├── desc.ts          # describe table tool
│   │   ├── export.ts        # export data tool
│   │   ├── import.ts        # import SQL file tool
│   │   └── exec.ts          # execute SQL tool
│   ├── templates/
│   │   └── commands.ts      # Natural language templates
│   ├── installer/
│   │   └── download.ts      # GitHub release downloader
│   └── cli/
│       └── binary.ts        # db-cli binary path management
├── package.json
├── tsconfig.json
└── README.md
```

### Pattern 1: GORM Multi-Database Connection

**What:** Extend `connection.go` to support Dameng via GORM driver switch

**When to use:** When adding database type support

**Example:**
```go
// internal/database/connection.go (extended)
import (
    "gorm.io/driver/mysql"
    // "gorm.io/driver/dm"  // If official dialect available
)

func OpenConnection(cfg ConnectionConfig) (*gorm.DB, error) {
    dsn, err := BuildDSN(cfg)
    if err != nil {
        return nil, err
    }

    switch cfg.DBType {
    case "mysql", "":
        return gorm.Open(mysql.Open(dsn), &gorm.Config{})
    case "dameng":
        // Option A: Official GORM dialect (preferred)
        // return gorm.Open(dm.Open(dsn), &gorm.Config{})

        // Option B: CGO driver with custom setup
        return openDamengCGO(cfg)
    default:
        return nil, fmt.Errorf("unsupported database type: %s", cfg.DBType)
    }
}
```

### Pattern 2: Dameng DSN Format

**What:** Dameng connection string format differs from MySQL

**When to use:** Building connection strings for Dameng

**Example:**
```go
// Dameng DSN format (verify with official docs)
// Standard: "user:password@tcp(host:port)/database"
// Or with additional params: "dm://user:password@host:port/database?schema=XXX"

func buildDamengDSN(cfg ConnectionConfig) (string, error) {
    port := cfg.Port
    if port == 0 {
        port = 5236 // Default Dameng port
    }
    // Format TBD based on driver requirements
    return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
        cfg.User, cfg.Password, cfg.Host, port, cfg.Database), nil
}
```

### Pattern 3: MCP Server Tool Definition

**What:** Define tools that the Skill exposes to Claude Code

**When to use:** Creating Skill commands

**Example:**
```typescript
// src/tools/count.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerCountTool(server: McpServer) {
  server.tool(
    'count',
    'Count rows in a database table',
    {
      host: z.string().describe('Database host IP'),
      database: z.string().describe('Database name'),
      user: z.string().describe('Database user'),
      password: z.string().describe('Database password'),
      table: z.string().describe('Table name'),
      where: z.string().optional().describe('WHERE clause'),
    },
    async ({ host, database, user, password, table, where }) => {
      const dbCliPath = await getBinaryPath();
      const whereClause = where ? ` WHERE ${where}` : '';
      const sql = `SELECT COUNT(*) FROM ${table}${whereClause}`;

      const { stdout, stderr } = await execa(dbCliPath, [
        'exec',
        '-h', host,
        '-u', user,
        '-p', password,
        '-d', database,
        sql,
      ]);

      if (stderr) throw new Error(stderr);
      return { content: [{ type: 'text', text: stdout }] };
    }
  );
}
```

### Pattern 4: Template-Based Command Parsing

**What:** Match natural language to predefined command templates

**When to use:** Converting user intent to db-cli commands

**Example:**
```typescript
// src/templates/commands.ts
interface CommandTemplate {
  name: string;
  patterns: RegExp[];
  extractParams: (match: RegExpMatchArray) => Record<string, string>;
}

const COUNT_TEMPLATES: CommandTemplate[] = [
  {
    name: 'count',
    patterns: [
      /(?:how many|count).*?(?:rows|records|entries).*?(?:in|from).*?(?:table\s+)?(\w+)/i,
      /(?:table\s+)?(\w+).*?has.*?(?:how many|what).*?rows/i,
    ],
    extractParams: (match) => ({
      table: match[1],
    }),
  },
];

function matchCommand(input: string): { tool: string; params: Record<string, string> } | null {
  for (const template of COUNT_TEMPLATES) {
    for (const pattern of template.patterns) {
      const match = input.match(pattern);
      if (match) {
        return {
          tool: template.name,
          params: template.extractParams(match),
        };
      }
    }
  }
  return null;
}
```

### Pattern 5: GitHub Release Binary Download

**What:** Download db-cli binary from GitHub Releases

**When to use:** Skill installation or update

**Example:**
```typescript
// src/installer/download.ts
import { Octokit } from '@octokit/rest';

async function downloadLatestRelease(owner: string, repo: string): Promise<string> {
  const octokit = new Octokit();

  // Get latest release
  const { data: release } = await octokit.repos.getLatestRelease({ owner, repo });
  const version = release.tag_name;

  // Determine platform
  const platform = getPlatformSuffix(); // e.g., 'windows-amd64.exe'

  // Find matching asset
  const asset = release.assets.find(a => a.name.endsWith(platform));
  if (!asset) {
    throw new Error(`No binary found for platform: ${platform}`);
  }

  // Download binary
  const downloadUrl = asset.browser_download_url;
  const response = await fetch(downloadUrl);
  const buffer = await response.arrayBuffer();

  // Save to local path
  const binaryPath = getLocalBinaryPath();
  await fs.writeFile(binaryPath, Buffer.from(buffer));
  await fs.chmod(binaryPath, 0o755);

  return binaryPath;
}
```

### Anti-Patterns to Avoid

- **Hardcoding SQL in Skill:** Never embed SQL in the Skill layer. Always delegate to db-cli.
- **Auto-updating without consent:** Don't auto-update db-cli without user permission (D-12).
- **Platform-specific paths:** Use platform-agnostic path resolution for binary management.
- **CGO without documentation:** If using CGO driver, document build requirements per platform.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub release download | Manual HTTP + JSON parsing | `@octokit/rest` or `go-github` | Handles auth, rate limiting, pagination |
| Archive extraction | Manual zip/tar parsing | `archiver` library | Cross-platform, handles edge cases |
| MCP server protocol | Raw stdio/HTTP handling | `modelcontextprotocol/go-sdk` | Protocol complexity, message framing |
| Natural language parsing | Complex NLP pipeline | Template regex matching | Simpler, predictable, no ML needed |
| GORM driver dialect | Custom ORM wrapper | Existing Dameng driver | Database-specific SQL dialects are complex |

**Key insight:** The template matching approach (D-9) is intentionally simple - it's pattern matching, not NLU. This keeps the Skill predictable and debuggable.

## Common Pitfalls

### Pitfall 1: Dameng Driver CGO Confusion

**What goes wrong:** Assuming driver is pure Go when it requires CGO and Dameng client libraries.

**Why it happens:** Most Go database drivers are pure Go (like `go-sql-driver/mysql`), but Dameng's official driver wraps C client libraries.

**How to avoid:**
1. Verify driver README for CGO requirements
2. Document platform-specific build steps
3. Consider providing pre-built binaries via GitHub Releases

**Warning signs:** Build fails with "undefined: dm.XXX" or C compiler errors.

### Pitfall 2: DSN Format Mismatch

**What goes wrong:** Using MySQL DSN format for Dameng connection.

**Why it happens:** Habit from MySQL implementation; DSN formats differ subtly.

**How to avoid:**
1. Check driver documentation for exact DSN format
2. Test connection with known-good credentials
3. Default port for Dameng is 5236, not 3306

**Warning signs:** Connection errors like "invalid DSN" or "protocol error".

### Pitfall 3: Skill Binary Path Not Found

**What goes wrong:** Skill can't locate db-cli binary after installation.

**Why it happens:** Incorrect path resolution, missing PATH environment, or download failure.

**How to avoid:**
1. Use standard binary locations (`~/.db-cli/bin/` or `%APPDATA%/.db-cli/bin/`)
2. Verify binary exists and is executable before use
3. Provide clear installation error messages

**Warning signs:** "Command not found" or EACCES errors.

### Pitfall 4: Template Pattern Too Greedy

**What goes wrong:** Template matches unintended input, extracts wrong parameters.

**Why it happens:** Regex patterns not specific enough.

**How to avoid:**
1. Test templates against diverse inputs
2. Use word boundaries (`\b`) and anchors
3. Validate extracted parameters before execution

**Warning signs:** Wrong table names, missing parameters, false matches.

### Pitfall 5: Windows CGO Build Complexity

**What goes wrong:** CGO build fails on Windows due to missing C toolchain or Dameng client.

**Why it happens:** Windows requires MSYS2/MinGW for CGO; Dameng client must be installed separately.

**How to avoid:**
1. Provide pre-built Windows binaries
2. Document Dameng client installation
3. Consider pure Go driver alternatives

**Warning signs:** "gcc not found" or "dmclient.h not found" errors.

## Code Examples

### Dameng Connection Extension

```go
// internal/database/connection.go (Phase 4 extension)

// openDamengCGO opens Dameng connection using CGO driver
// Requires: Dameng client libraries installed, CGO enabled
func openDamengCGO(cfg ConnectionConfig) (*gorm.DB, error) {
    dsn, err := buildDamengDSN(cfg)
    if err != nil {
        return nil, err
    }

    // Import driver with side effects
    // _ "github.com/cherishlee/dm-go-driver"

    // Open using database/sql pattern
    sqlDB, err := sql.Open("dm", dsn)
    if err != nil {
        return nil, fmt.Errorf("failed to open Dameng connection: %w", err)
    }

    return gorm.Open(gormDialectForDameng(sqlDB), &gorm.Config{})
}

// buildDamengDSN builds DSN for Dameng
// Format: "user:password@host:port/schema?param=value"
func buildDamengDSN(cfg ConnectionConfig) (string, error) {
    port := cfg.Port
    if port == 0 {
        port = 5236 // Default Dameng port
    }

    // Verify with driver documentation - format may differ
    return fmt.Sprintf("%s:%s@%s:%d/%s",
        cfg.User,
        cfg.Password,
        cfg.Host,
        port,
        cfg.Database,
    ), nil
}
```

### MCP Server Entry Point

```typescript
// src/index.ts - db-cli-skill MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const server = new McpServer({
    name: 'db-cli-skill',
    version: '1.0.0',
  });

  // Register tools
  registerCountTool(server);
  registerDescTool(server);
  registerExportTool(server);
  registerImportTool(server);
  registerExecTool(server);

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Template Matcher

```typescript
// src/templates/matcher.ts
interface MatchResult {
  tool: string;
  params: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
  missingParams: string[];
}

function matchUserIntent(input: string): MatchResult | null {
  // Try each template in priority order
  const templates = getAllTemplates();

  for (const template of templates) {
    for (const pattern of template.patterns) {
      const match = input.match(pattern);
      if (match) {
        const params = template.extractParams(match);
        const missing = template.requiredParams?.filter(p => !params[p]) || [];

        return {
          tool: template.name,
          params,
          confidence: missing.length === 0 ? 'high' : 'medium',
          missingParams: missing,
        };
      }
    }
  }

  return null; // No match found
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CLI parser | Cobra framework | Industry standard | Better UX, help generation |
| Direct SQL generation | Template matching | Phase 4 design | More predictable, auditable |
| Config file storage | In-memory only (flags) | Security requirement | No secrets on disk |
| Manual binary download | GitHub Releases auto-download | Phase 4 feature | Easier installation |

**Deprecated/outdated:**
- **Direct LLM SQL generation:** Replaced by template matching (D-10) for safety and predictability
- **Config file approach:** Explicitly out of scope per project constraints

## Open Questions

1. **Dameng driver import path and availability**
   - What we know: `github.com/cherishlee/dm-go-driver` exists but needs verification
   - What's unclear: Current maintenance status, GORM compatibility, CGO requirements
   - Recommendation: Test driver in Phase 4; have fallback to manual driver implementation

2. **Dameng DSN exact format**
   - What we know: Differs from MySQL; default port is 5236
   - What's unclear: Exact syntax, parameter support, SSL options
   - Recommendation: Verify with driver README or Dameng documentation

3. **MCP Go SDK vs TypeScript for Skill**
   - What we know: Both Go and TypeScript MCP SDKs exist
   - What's unclear: Which is more mature; TypeScript may have better Claude Code integration
   - Recommendation: Use TypeScript for Skill (MCP server) as Claude Code ecosystem favors it

4. **CGO-free Dameng driver availability**
   - What we know: Most Go drivers for commercial DBs use CGO
   - What's unclear: Whether a pure Go Dameng driver exists
   - Recommendation: Prioritize pure Go search; if unavailable, document CGO build thoroughly

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Go | db-cli build | ✓ | 1.x | — |
| Node.js | Skill development | TBD | — | — |
| Dameng client libraries | Dameng CGO driver | TBD | — | Use pure Go driver if available |
| GCC/MinGW | Windows CGO build | TBD | — | Pre-built binaries |

**Missing dependencies with no fallback:**
- None identified yet; requires environment audit

**Missing dependencies with fallback:**
- Dameng driver: If CGO driver unavailable, may need to implement custom GORM dialect (LOW confidence on availability)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go `testing` package (built-in) |
| Config file | None detected |
| Quick run command | `go test ./... -short` |
| Full suite command | `go test ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-03 | Dameng connection via GORM | integration | `go test ./internal/database -run TestDamengConnection` | ❌ Wave 0 |
| SKILL-01 | Template matching parses intent | unit | N/A (TypeScript) | ❌ Wave 0 |
| SKILL-02 | Binary download from GitHub | integration | N/A (TypeScript) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `go test ./... -short`
- **Per wave merge:** `go test ./...`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `internal/database/connection_dameng_test.go` — Dameng connection tests
- [ ] `src/templates/matcher.test.ts` — Template matching unit tests
- [ ] `src/installer/download.test.ts` — Binary download tests

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `cmd/root.go`, `internal/database/connection.go`, `cmd/exec.go`
- CLAUDE.md technology stack: Cobra v1.10.2, GORM v1.30+, go-sql-driver/mysql v1.9.3
- .planning/REQUIREMENTS.md: CONN-03, SKILL-01, SKILL-02 requirements
- 04-CONTEXT.md: User decisions D-01 through D-13

### Secondary (MEDIUM confidence)
- GORM documentation patterns (based on MySQL driver implementation)
- MCP protocol specification (general knowledge)
- GitHub Releases API patterns

### Tertiary (LOW confidence) - NEEDS VALIDATION
- `github.com/cherishlee/dm-go-driver` existence and API
- `github.com/modelcontextprotocol/go-sdk` current state
- Dameng DSN exact format
- CGO requirements for Dameng drivers

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Driver availability needs hands-on verification
- Architecture: HIGH - Based on existing codebase patterns and user decisions
- Pitfalls: MEDIUM - Based on typical Go/databases integration challenges

**Research date:** 2026-03-31
**Valid until:** 90 days (stable technologies: Go, GORM, MCP protocol)

---

## Appendix: Dameng Driver Research Notes

**Investigated options:**

1. **gorm.io/driver/dm** (Official GORM dialect - PREFERRED)
   - Status: UNKNOWN - Web fetch blocked, couldn't verify existence
   - If available: Seamless integration, no CGO likely needed
   - Action: Verify during implementation

2. **github.com/cherishlee/dm-go-driver** (Community driver)
   - Status: Exists but maintenance status unknown
   - Likely requires CGO (wraps Dameng C client)
   - Import path: Verify exact path

3. **dm8_go_driver** (Alternative)
   - Status: UNKNOWN
   - May be pure Go implementation
   - Action: Search GitHub during planning

**Recommendation:** Start with option 1 verification. If unavailable, test option 2 and document CGO requirements per platform.
