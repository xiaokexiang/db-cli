# db-cli

## What This Is

一个 Go 语言开发的跨平台数据库 CLI 工具，使用 GORM 集成 MySQL 和达梦数据库。用户每次执行时通过 flag 指定完整连接信息（host/port/user/password/database），CLI 提供 CRUD、DDL、SQL 导入导出功能。配套 Claude Code Skill 将自然语言转换为 db-cli 命令调用。

## Core Value

让用户通过自然语言或简单命令即可完成数据库操作，无需记忆复杂的 SQL 语法和连接参数，同时保持对数据库的完全控制。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **CONN-01**: 支持通过 flag 指定数据库连接参数（host/port/user/password/database/type）
- [ ] **CONN-02**: 支持 MySQL 数据库连接（使用 GORM + go-sql-driver/mysql）
- [ ] **CONN-03**: 支持达梦数据库连接（使用 GORM + dm-go-driver）
- [ ] **EXEC-01**: exec 命令支持执行单条 SQL 语句
- [ ] **EXEC-02**: exec 命令支持执行 SQL 文件
- [ ] **EXEC-03**: SQL 文件执行遇到错误时立即停止并显示错误码和信息
- [ ] **EXEC-04**: 支持 --autocommit flag 控制事务提交方式
- [ ] **DQL-01**: 查询结果默认以 JSON 格式输出
- [ ] **DQL-02**: 支持表格/CSV 等输出格式选项
- [ ] **DDL-01**: desc 命令支持查看表结构（字段、类型、约束）
- [ ] **DDL-02**: desc 命令支持查看索引和外键
- [ ] **DDL-03**: desc 命令支持查看数据库元数据
- [ ] **IO-01**: export 命令支持按查询导出为 SQL INSERT 语句
- [ ] **IO-02**: export 命令支持导出 DDL 语句
- [ ] **IO-03**: import 命令导入 SQL 文件
- [ ] **LOG-01**: 记录命令历史（不含密码等敏感信息）
- [ ] **LOG-02**: 记录错误日志
- [ ] **SKILL-01**: Claude Code Skill 支持自然语言解析为 db-cli 命令
- [ ] **SKILL-02**: Skill 安装时自动从 GitHub Releases 下载 db-cli
- [ ] **PLATFORM-01**: 支持 Windows/macOS/Linux 跨平台编译

### Out of Scope

- 交互式 REPL 模式 — 用户偏好纯子命令设计
- 环境配置管理 — 每次执行时手动指定连接参数
- 密码存储 — 不保存敏感信息到配置文件
- AI 内置 — CLI 本身不提供 AI 能力，由 Skill 层负责
- 安全限制 — 不拦截 CRUD 操作，信任配置即权限

## Context

**设计背景**:
- 用户需要通过自然语言操作数据库（如"查询 10.50.13.41 环境的 bocloud_upms 库的 upms_core_account 表有多少数据"）
- 当前方案需要手动编写 SQL 和执行命令
- 通过 Claude Code Skill + db-cli 两层架构实现：Skill 负责意图理解，CLI 负责执行

**技术栈**:
- 语言：Go
- ORM: GORM
- MySQL 驱动：go-sql-driver/mysql
- 达梦驱动：dm-go-driver (需调研可用性)
- 分发：GitHub Releases

## Constraints

- **[数据库]**: MySQL 和达梦数据库必须支持 — 业务环境需求
- **[跨平台]**: Windows/macOS/Linux 都需要支持 — 用户开发环境多样
- **[无配置]**: 不存储连接信息 — 安全考虑，每次手动指定
- **[GORM 优先]**: 使用 GORM 统一数据库操作 — 便于扩展和维护

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GORM 作为 ORM 层 | 统一 MySQL 和达梦连接方式，便于扩展 | — Pending |
| 无环境配置设计 | 简化 CLI 设计，减少配置管理复杂度 | — Pending |
| Skill + CLI 两层架构 | 分离关注点：AI 处理意图，CLI 专注执行 | — Pending |
| 错误立即中断 | SQL 文件执行失败时避免级联错误 | — Pending |
| JSON 默认输出 | 机器可读，便于后续处理 | — Pending |
| 双仓库管理 | CLI 和 Skill 独立版本控制 | — Pending |

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
*Last updated: 2026-03-31 after initialization*
