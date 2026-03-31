<!-- GSD:project-start source:PROJECT.md -->
## Project

**db-cli**

一个 Go 语言开发的跨平台数据库 CLI 工具，使用 GORM 集成 MySQL 和达梦数据库。用户每次执行时通过 flag 指定完整连接信息（host/port/user/password/database），CLI 提供 CRUD、DDL、SQL 导入导出功能。配套 Claude Code Skill 将自然语言转换为 db-cli 命令调用。

**Core Value:** 让用户通过自然语言或简单命令即可完成数据库操作，无需记忆复杂的 SQL 语法和连接参数，同时保持对数据库的完全控制。

### Constraints

- **[数据库]**: MySQL 和达梦数据库必须支持 — 业务环境需求
- **[跨平台]**: Windows/macOS/Linux 都需要支持 — 用户开发环境多样
- **[无配置]**: 不存储连接信息 — 安全考虑，每次手动指定
- **[GORM 优先]**: 使用 GORM 统一数据库操作 — 便于扩展和维护
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core CLI Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **cobra** | v1.10.2 | CLI framework | Industry standard for Go CLIs. Used by kubectl, hugo, gh. Rich subcommand support, automatic help generation, flag validation, bash completion. Mature and stable. |
### Database ORM
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **GORM** | v1.30+ | ORM layer | Go's most popular ORM. Supports MySQL, PostgreSQL, SQLite, SQL Server, and custom drivers. Provides connection pooling, migration helpers, and unified API across databases. |
### MySQL Driver
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **go-sql-driver/mysql** | v1.9.3 | MySQL driver for database/sql | Official MySQL driver. Pure Go (no CGO). Actively maintained. Supports MySQL 5.7-8.x. Works seamlessly with GORM. |
### Dameng (达梦) Driver
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **dm-go-driver** | Latest (check GitHub) | Dameng DM8 driver | Official Dameng Go driver. **Requires CGO** and Dameng client libraries (dmclient). Alternative: `dm8_go_driver` if available. |
### Configuration & Flags
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **spf13/pflag** | Latest | Flag parsing (bundled with Cobra) | Cobra uses pflag internally. Supports POSIX-style flags, flag sets, and validation. No additional dependency needed. |
### Optional: Logging
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **uber-go/zap** or **rs/zerolog** | Latest | Structured logging | For command history and error logging (REQ LOG-01, LOG-02). Zeroalloc Zap or zerolog for performance. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI Framework | cobra | urfave/cli v3 | Cobra has larger ecosystem, better subcommand nesting, automatic man/help generation. urfave/cli is lighter but less feature-rich. |
| CLI Framework | cobra | flag (stdlib) | Too basic for complex CLI. No subcommand support, no help generation. Only for simple tools. |
| ORM | GORM | sqlx | GORM provides higher-level abstraction, better for multiple database support. sqlx is closer to raw SQL. |
| MySQL Driver | go-sql-driver/mysql | go-mysql-driver/go-mysql | go-sql-driver is the official Database/sql compatible driver. go-mysql is a different API paradigm. |
| Config | pflag (Cobra builtin) | viper | Viper is for file-based config. This project explicitly avoids config files (security requirement). |
## Installation
# Initialize Go module
# Core CLI framework
# ORM layer
# MySQL driver
# Dameng driver (verify import path - may require CGO)
# Option 1: Official dm-go-driver (if available on GitHub)
# Optional: structured logging
# OR
## GORM Multi-Database Configuration
## Cross-Platform Build Strategy
### GOOS/GOARCH Targets
| Platform | GOOS | GOARCH | Notes |
|----------|------|--------|-------|
| Windows x64 | windows | amd64 | Standard Windows builds |
| Windows ARM | windows | arm64 | Surface Pro, ARM laptops |
| macOS Intel | darwin | amd64 | Intel Macs |
| macOS Apple Silicon | darwin | arm64 | M1/M2/M3 Macs |
| Linux x64 | linux | amd64 | Most servers, WSL2 |
| Linux ARM64 | linux | arm64 | Raspberry Pi, ARM servers |
### Build Commands
# Windows (amd64)
# macOS (Intel)
# macOS (Apple Silicon)
# Linux (amd64)
### Dameng Driver CGO Considerations
- MySQL-first approach with Dameng as "advanced" feature requiring CGO build
- Static compilation with `-ldflags="-extldflags '-static'"` where possible
### GitHub Actions CI/CD Setup
# .github/workflows/release.yml
## Version Recommendations (Summary)
| Package | Version | Go Mod Command |
|---------|---------|----------------|
| cobra | v1.10.2 | `go get github.com/spf13/cobra@v1.10.2` |
| GORM | v1.30+ (latest) | `go get gorm.io/gorm@latest` |
| go-sql-driver/mysql | v1.9.3 | `go get github.com/go-sql-driver/mysql@v1.9.3` |
| dm-go-driver | Latest available | `go get github.com/cherishlee/dm_go_driver` (verify path) |
| pflag | Bundled with Cobra | (no separate install needed) |
## Dameng Driver Research Status ⚠️
- Verify the correct import path and CGO requirements
- Test if GORM integration works with discovered driver
- If CGO required, document build dependencies per platform
## Sources
- [Cobra v1.10.2 Release](https://github.com/spf13/cobra/releases/tag/v1.10.2) - HIGH confidence
- [go-sql-driver/mysql v1.9.3](https://github.com/go-sql-driver/mysql/releases/tag/v1.9.3) - HIGH confidence
- [urfave/cli v3.8.0](https://github.com/urfave/cli/releases/tag/v3.8.0) - HIGH confidence
- GORM documentation - MEDIUM confidence (web fetch blocked, based on search results)
- Dameng driver availability - LOW confidence (requires hands-on verification)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
