# db-cli Requirements

## v1 Requirements

### Connection (CONN)

- [x] **CONN-01**: 支持通过 flag 指定数据库连接参数
  - Flags: `-h/--host`, `-P/--port`, `-u/--user`, `-p/--password`, `-d/--database`, `-t/--type`
  - 数据库类型：`mysql`, `dameng`
  - 密码支持从 stdin 读取（`--password=-`）避免命令行暴露
- [x] **CONN-02**: MySQL 数据库连接
  - 使用 GORM + go-sql-driver/mysql v1.9.3
  - 支持 MySQL 5.7+ 和 8.x
- [ ] **CONN-03**: 达梦数据库连接
  - 使用 GORM + dm-go-driver（需验证可用性）
  - 支持达梦 DM8+

### Execution (EXEC)

- [x] **EXEC-01**: 执行单条 SQL 语句
  - 命令：`db-cli exec -h ... -u ... -p ... -d ... 'SELECT ...'`
  - 支持所有 SQL 类型（SELECT/INSERT/UPDATE/DELETE/DDL）
- [x] **EXEC-02**: 执行 SQL 文件
  - 命令：`db-cli exec -h ... -u ... -p ... -d ... --file=xxx.sql`
  - 支持大文件（逐条解析执行）
- [ ] **EXEC-03**: 错误处理
  - SQL 文件执行遇到错误立即停止
  - 显示错误码和错误信息
  - 返回非零退出码
- [x] **EXEC-04**: 事务控制
  - `--autocommit=true`（默认）：每条 SQL 自动提交
  - `--autocommit=false`：SQL 文件内的 BEGIN/COMMIT/ROLLBACK 生效

### Query (DQL)

- [x] **DQL-01**: JSON 格式输出
  - 默认输出格式
  - 数组包裹，每行一个 JSON 对象
- [ ] **DQL-02**: 多格式支持
  - `--format=json`（默认）
  - `--format=table`：ASCII 表格
  - `--format=csv`：CSV 格式（支持自定义分隔符）

### Schema Inspection (DESC)

- [ ] **DESC-01**: 查看表结构
  - 命令：`db-cli desc -h ... -u ... -p ... -d ... --table=xxx`
  - 显示字段名、类型、长度、是否为空、默认值
- [ ] **DESC-02**: 查看索引
  - `--indexes` flag：显示表的索引信息
- [ ] **DESC-03**: 查看外键
  - `--foreign-keys` flag：显示外键约束
- [ ] **DESC-04**: 查看元数据
  - `--databases`：列出所有数据库
  - `--tables`：列出所有表

### Import/Export (IO)

- [ ] **IO-01**: 导入 SQL 文件
  - 命令：`db-cli import -h ... -u ... -p ... -d ... --file=xxx.sql`
  - 等价于 `exec --file`，语义更清晰
- [ ] **IO-02**: 导出查询结果
  - 命令：`db-cli export -h ... -u ... -p ... -d ... --query='SELECT ...' --output=file.sql`
  - 支持 `--format=insert`（生成 INSERT 语句）
  - 支持 `--format=ddl`（生成建表语句）
- [ ] **IO-03**: 导出整表
  - 命令：`db-cli export -h ... -u ... -p ... -d ... --table=xxx --output=file.sql`
  - 导出表结构和数据

### Logging (LOG)

- [ ] **LOG-01**: 命令历史
  - 记录执行过的命令（不含密码）
  - 密码字段显示为 `***`
  - 存储位置：`~/.db-cli/history.log`
- [ ] **LOG-02**: 错误日志
  - 记录错误信息到 `~/.db-cli/error.log`
  - 包含时间戳、命令、错误码、错误信息

### Skill Integration (SKILL)

- [ ] **SKILL-01**: Claude Code Skill
  - 解析自然语言为 db-cli 命令
  - 示例：`db-cli count --host=10.50.13.41 --database=bocloud_upms --table=upms_core_account`
- [ ] **SKILL-02**: 自动下载
  - Skill 安装时从 GitHub Releases 下载 db-cli 二进制
  - 支持增量更新检查

### Platform (PLATFORM)

- [ ] **PLATFORM-01**: 跨平台编译
  - Windows: `windows/amd64`, `windows/arm64`
  - macOS: `darwin/amd64`, `darwin/arm64`
  - Linux: `linux/amd64`, `linux/arm64`
- [ ] **PLATFORM-02**: 单一二进制
  - 无外部依赖（除 Dameng 可能需要 CGO）
  - 开箱即用

---

## v2 Requirements (Deferred)

- [ ] 支持 PostgreSQL 数据库
- [ ] 支持 SQLite 数据库
- [ ] 批量模式：从 stdin 读取 SQL
- [ ] 进度条：大文件导入显示进度
- [ ] 并发导入：并行执行 INSERT 语句
- [ ] 数据脱敏：导出时自动脱敏敏感字段
- [ ] SQL 格式化：美化输出的 SQL 语句

---

## Out of Scope

- **交互式 REPL 模式** — 用户偏好纯子命令设计，CI/CD 友好
- **环境配置管理** — 每次执行时手动指定连接参数，减少配置复杂度
- **密码存储** — 不保存敏感信息到配置文件，安全考虑
- **AI 内置** — CLI 本身不提供 AI 能力，由 Skill 层负责
- **安全限制** — 不拦截 CRUD 操作，信任配置即权限
- **连接池配置** — 使用 GORM 默认设置，简化设计

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 1 | Complete |
| CONN-02 | Phase 1 | Complete |
| CONN-03 | Phase 2 | Pending |
| EXEC-01 | Phase 1 | Complete |
| EXEC-02 | Phase 1 | Complete |
| EXEC-03 | Phase 1 | Pending |
| EXEC-04 | Phase 1 | Complete |
| DQL-01 | Phase 1 | Complete |
| DQL-02 | Phase 2 | Pending |
| DESC-01 | Phase 2 | Pending |
| DESC-02 | Phase 2 | Pending |
| DESC-03 | Phase 2 | Pending |
| DESC-04 | Phase 2 | Pending |
| IO-01 | Phase 1 | Complete |
| IO-02 | Phase 2 | Pending |
| IO-03 | Phase 2 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| SKILL-01 | Phase 4 | Pending |
| SKILL-02 | Phase 4 | Pending |
| PLATFORM-01 | Phase 1 | Complete |
| PLATFORM-02 | Phase 1 | Complete |

---

*Last updated: 2026-03-31 after research*
