# Phase 4: Dameng & Skill Integration - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

实现达梦数据库连接支持和 Claude Code Skill 集成。Phase 4 完成后，用户可：
1. 通过 `-t dameng` 连接达梦数据库执行 SQL
2. 通过 Claude Code Skill 使用自然语言操作数据库（如 "查询 10.50.13.41 环境的 bocloud_upms 库的 upms_core_account 表有多少数据"）

Skill 集成包括：独立仓库、自动下载 db-cli 二进制、模板匹配命令解析、交互式参数引导。

</domain>

<decisions>
## Implementation Decisions

### 达梦数据库驱动
- **D-01:** 优先调研纯 Go 驱动方案（无需 CGO，构建简单）
- **D-02:** 如果纯 Go 驱动不可用，提供 CGO 构建方案和各平台指南
- **D-03:** 具体驱动选型留到 research 阶段决定，不提前锁定

### 达梦连接方式
- **D-04:** 统一 flag 设计：`db-cli exec -t dameng -h ... -u ... -p ... -d ... 'SQL'`
- **D-05:** 仅在与 MySQL 有差异时，为 dameng 添加额外专用 flag

### Skill 架构
- **D-06:** Skill 为独立仓库（db-cli-skill），独立版本控制
- **D-07:** Skill 安装时自动从 GitHub Releases 下载最新 db-cli 二进制

### Skill 命令设计
- **D-08:** 精简命令集：count、desc、export、import、exec
- **D-09:** 采用模板匹配方式：自然语言 → 匹配预定义命令模板 → 填充参数生成 db-cli 命令
- **D-10:** 模板匹配优于 LLM 直接生成 SQL，更可控、可预测、安全

### Skill 交互方式
- **D-11:** 交互式引导：Skill 检测到缺失必需参数时，逐个询问用户
- **D-12:** 更新机制：手动更新，不自动检查

### 发布策略
- **D-13:** 使用 GitHub Actions CI/CD 自动构建并发布到 GitHub Releases

### Claude's Discretion
- 达梦驱动的具体选型和验证
- Skill 的具体实现架构和代码组织
- 模板匹配的具体算法和规则设计
- 发布流程的具体配置

</decisions>

<specifics>
## Specific Ideas

- "模板匹配方式"：用户说 'count rows in table X' → 匹配到 count 模板 → 填充参数生成 `db-cli exec 'SELECT COUNT(*) FROM X'`
- 达梦连接尽量与 MySQL 保持一致，仅在有差异时才单独处理
- Skill 逐个参数询问，避免一次性抛出太多问题让用户困惑

</specifics>

<canonical_refs>
## Canonical References

### 技术栈约束
- `CLAUDE.md` — 项目核心约束：MySQL 和达梦必须支持、跨平台、无配置存储、GORM 优先
- `.planning/PROJECT.md` — 核心 value、决策日志、v1 Requirements 状态
- `.planning/REQUIREMENTS.md` — SKILL-01、SKILL-02、CONN-03 需求详情

### 已有实现参考
- `.planning/phases/01-mysql-core-execution/` — Phase 1 MySQL 连接和 exec 命令实现
- `.planning/phases/02-schema-inspection-import-export/` — Phase 2 多格式输出和 desc/export 命令
- `.planning/phases/03-logging-polish/` — Phase 3 日志和 history/errors 命令

### 依赖版本
- `CLAUDE.md` §Technology Stack — Cobra v1.10.2, GORM v1.30+, go-sql-driver/mysql v1.9.3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cmd/exec.go` — exec 命令实现，可复用于达梦连接（只需扩展 `-t` flag 支持）
- `internal/database/connection.go` — GORM 连接工厂模式，可扩展 Dameng 支持
- `cmd/root.go` — Cobra root 命令和 persistent flags 定义
- `cmd/desc.go` — desc 命令实现，Skill 可调用
- `cmd/export.go` — export 命令实现，Skill 可调用

### 已建立的 Patterns
- 数据库类型通过 `-t/--type` flag 区分（mysql/dameng）
- 连接参数：`-h/--host`, `-P/--port`, `-u/--user`, `-p/--password`, `-d/--database`
- 输出格式：`--format=json|table|csv`
- 日志记录：`~/.db-cli/history.log` 和 `error.log`，密码脱敏

### Integration Points
- Skill 将调用已实现的 db-cli 命令（exec、desc、export 等），无需重复实现
- 达梦驱动需要集成到现有的 GORM 连接工厂中

</code_context>

<deferred>
## Deferred Ideas

- 达梦驱动的具体选型和验证 — research 阶段决定
- 丰富的快捷命令集（list、show、create、drop 等）— 后续阶段扩展
- Skill 自动检查更新 — 暂不需要，手动更新即可
- 版本管理功能 — 暂不需要

</deferred>

---

*Phase: 04-dameng-skill-integration*
*Context gathered: 2026-03-31*
