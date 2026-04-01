# db-cli

## What This Is

一个 Go 语言开发的跨平台数据库 CLI 工具，使用 GORM 集成 MySQL 和达梦数据库。用户每次执行时通过 flag 指定完整连接信息（host/port/user/password/database），CLI 提供 CRUD、DDL、SQL 导入导出功能。配套 Claude Code Skill 将自然语言转换为 db-cli 命令调用。

## Core Value

让用户通过自然语言或简单命令即可完成数据库操作，无需记忆复杂的 SQL 语法和连接参数，同时保持对数据库的完全控制。

## Requirements

### Validated (v1.0)

All 22 v1 requirements validated and shipped in v1.0 milestone. See `.planning/milestones/v1.0-REQUIREMENTS.md` for full archive.

**Core Requirements:**

- ✓ **CONN-01/02/03**: Connection support (MySQL + Dameng) — v1.0
- ✓ **EXEC-01/02/03/04**: SQL execution (single, file, error handling, transactions) — v1.0
- ✓ **DQL-01/02**: Multi-format output (JSON, table, CSV) — v1.0
- ✓ **DESC-01/02/03/04**: Schema inspection (table, indexes, foreign keys, metadata) — v1.0
- ✓ **IO-01/02/03**: Import/export (SQL file, query export, table export) — v1.0
- ✓ **LOG-01/02**: Logging (command history, error logs with password redaction) — v1.0
- ✓ **SKILL-01/02**: Claude Code Skill (natural language parsing, auto-download from GitHub Releases) — v1.0
- ✓ **PLATFORM-01/02**: Cross-platform builds (6 platforms, pure Go binary) — v1.0

### Active

(None — v1.0 complete. Next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope (v1.0)

- **交互式 REPL 模式** — 用户偏好纯子命令设计，CI/CD 友好
- **环境配置管理** — 每次执行时手动指定连接参数，安全考虑
- **密码存储** — 不保存敏感信息到配置文件
- **AI 内置** — CLI 本身不提供 AI 能力，由 Skill 层负责
- **安全限制** — 不拦截 CRUD 操作，信任配置即权限
- **连接池配置** — 使用 GORM 默认设置，简化设计

## Current State (v1.0 Shipped)

**Version:** v1.0 MVP — Complete (2026-04-01)

**What Was Built:**

A cross-platform database CLI tool written in Go with GORM integration for MySQL and Dameng databases. Users specify connection via DSN URL (`-c` flag) and can execute SQL, inspect schema, import/export data with multi-format output (JSON, table, CSV). Ships with Claude Code Skill for natural language command generation and automated binary installation from GitHub Releases.

**Technical Stats:**

| Metric | Value |
|--------|-------|
| Lines of Code | ~2,000 Go |
| Commands | exec, import, export, desc, history, errors, ping |
| Databases | MySQL 5.7+, Dameng DM8+ |
| Platforms | Windows/macOS/Linux (amd64, arm64) |
| Skill Tools | count, desc, export, import, exec |

**Key Design Choices:**

- DSN URL format for all connections (`mysql://...` or `dameng://...`)
- No configuration files (security requirement)
- Pure Go binaries (no CGO required for Dameng)
- Template matching over LLM SQL generation (safer, more controllable)

---

## Context

**设计背景**:
- 用户需要通过自然语言操作数据库（如"查询 10.50.13.41 环境的 bocloud_upms 库的 upms_core_account 表有多少数据"）
- 当前方案需要手动编写 SQL 和执行命令
- 通过 Claude Code Skill + db-cli 两层架构实现：Skill 负责意图理解，CLI 负责执行

**技术栈**:
- 语言：Go
- ORM: GORM
- MySQL 驱动：go-sql-driver/mysql v1.9.3
- 达梦驱动：github.com/godoes/gorm-dameng v0.7.2 (纯 Go，无需 CGO)
- 分发：GitHub Releases (6 平台支持)

## Constraints

- **[数据库]**: MySQL 和达梦数据库必须支持 — 业务环境需求
- **[跨平台]**: Windows/macOS/Linux 都需要支持 — 用户开发环境多样
- **[无配置]**: 不存储连接信息 — 安全考虑，每次手动指定
- **[GORM 优先]**: 使用 GORM 统一数据库操作 — 便于扩展和维护

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GORM 作为 ORM 层 | 统一 MySQL 和达梦连接方式，便于扩展 | ✅ v1.0 |
| 无环境配置设计 | 简化 CLI 设计，减少配置管理复杂度 | ✅ v1.0 |
| Skill + CLI 两层架构 | 分离关注点：AI 处理意图，CLI 专注执行 | ✅ v1.0 |
| 错误立即中断 | SQL 文件执行失败时避免级联错误 | ✅ v1.0 |
| JSON 默认输出 | 机器可读，便于后续处理 | ✅ v1.0 |
| MySQL-first MVP | 避免 Phase 1 中的 CGO/达梦复杂性 | ✅ v1.0 |
| Table/CSV 格式化器使用标准库 | MVP 不引入外部依赖 | ✅ v1.0 |
| Dameng 驱动：gorm-dameng v0.7.2 | 纯 Go 实现，无需 CGO | ✅ v1.0 |
| DSN 格式：dm://user:pass@host:port?schema=db | gorm-dameng 要求的格式 | ✅ v1.0 |
| 模板匹配优于 LLM SQL 生成 | 更可控、可预测、更安全 | ✅ v1.0 |
| CLI 简化为只用 -c 标志 | 更简单的用户体验，避免标志冲突 | ✅ v1.0 |
| 默认数据库：MySQL→mysql, Dameng→用户名 | 使数据库在 DSN 中可选 | ✅ v1.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after v1.0 milestone complete*
