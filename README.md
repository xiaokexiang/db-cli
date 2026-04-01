# db-cli

一个 Go 语言开发的跨平台数据库 CLI 工具，使用 GORM 集成 MySQL 和达梦数据库。

## 特性

- **跨数据库支持**: MySQL 和达梦数据库 (DM8)
- **跨平台**: Windows/macOS/Linux
- **简洁的连接方式**: 只使用 DSN URL (`-c`) 一种方式
- **无需配置文件**: 每次执行时通过 flag 指定连接信息，安全
- **密码特殊字符支持**: 使用 URL 编码处理特殊字符

## 安装

```bash
go build -o db-cli .
```

## 快速开始

### 连接方式

只使用 `-c` 参数指定 DSN URL：

```bash
# MySQL
db-cli exec -c 'mysql://root:password@10.50.8.44:3306/mydb' 'SELECT * FROM users'

# Dameng
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' 'SELECT * FROM users'
```

### DSN URL 格式

```
<type>://<user>:<password>@<host>:<port>[/<database>]
```

**说明:**

- `type`: `mysql` 或 `dameng`
- `user`: 用户名
- `password`: 密码（特殊字符需要 URL 编码，如 `@` 编码为 `%40`）
- `host`: 主机地址
- `port`: 端口（MySQL 默认 3306，Dameng 默认 5236）
- `database`: 数据库名/schema（可选）
  - MySQL 默认为 `mysql`
  - 达梦默认为用户名

**示例:**

```bash
# MySQL - 不指定数据库（默认连接 mysql）
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306' 'SELECT 1'

# MySQL - 指定数据库
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' 'SELECT 1'

# Dameng - 不指定 schema（默认使用用户名 SYSDBA）
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' 'SELECT 1'

# Dameng - 指定 schema
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236/TEST' 'SELECT 1'

# 密码包含特殊字符（@ 编码为 %40）
db-cli exec -c 'mysql://root:p%40ssword@10.50.8.44:3306/mydb' 'SELECT 1'
```

---

## 命令列表

### version

显示版本信息

```bash
db-cli version
```

### exec

执行 SQL 语句（支持多行，分号分隔）

```bash
# MySQL - 单条 SQL
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' 'SELECT * FROM users'

# MySQL - 多条 SQL
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' 'SELECT 1; SELECT 2; SELECT 3'

# Dameng - 单条 SQL
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' 'SELECT * FROM users'

# 表格输出（默认）
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' 'SELECT * FROM users'

# JSON 输出
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' --format=json 'SELECT * FROM users'

# 生成 INSERT 语句（MySQL）
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' --format=sql 'SELECT * FROM users'

# 生成 INSERT 语句（Dameng）
db-cli exec -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' --format=sql 'SELECT * FROM users'

# 事务模式执行（要么全部成功，要么全部回滚）
db-cli exec -c 'mysql://root:123456@10.50.8.44:3306/mydb' --autocommit=false 'UPDATE users SET age=20; UPDATE users SET status=1'
```

**专属 Flags:**

| Flag | 说明 | 默认值 |
|------|------|--------|
| `--format` | 输出格式：table, json, sql | table |
| `--autocommit` | 自动提交每条语句 | true |

支持格式：`table` (默认), `json`, `sql`

---

### desc

查看数据库 schema 信息

```bash
# MySQL - 列出所有数据库
db-cli desc --databases -c 'mysql://root:123456@10.50.8.44:3306/mysql'

# MySQL - 列出所有表
db-cli desc --tables -c 'mysql://root:123456@10.50.8.44:3306/mydb'

# MySQL - 查看表结构
db-cli desc -t users -c 'mysql://root:123456@10.50.8.44:3306/mydb'

# MySQL - 查看索引
db-cli desc -t users --indexes -c 'mysql://root:123456@10.50.8.44:3306/mydb'

# MySQL - 查看外键
db-cli desc -t users --foreign-keys -c 'mysql://root:123456@10.50.8.44:3306/mydb'

# Dameng - 列出所有 Schema
db-cli desc --databases -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236'

# Dameng - 列出所有表
db-cli desc --tables -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236'

# Dameng - 查看表结构
db-cli desc -t USERS -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236'
```

**专属 Flags:**

| Flag | 简写 | 说明 |
|------|------|------|
| `--table` | `-t` | 表名 |
| `--indexes` | | 显示索引 |
| `--foreign-keys` | | 显示外键 |
| `--tables` | | 列出所有表 |
| `--databases` | | 列出所有数据库 |

---

### export

导出数据到文件（格式由文件后缀自动判断）

```bash
# MySQL - 导出查询结果为 SQL
db-cli export -c 'mysql://root:123456@10.50.8.44:3306/mydb' \
  -q "SELECT * FROM users" \
  -o users.sql

# MySQL - 导出查询结果为 JSON
db-cli export -c 'mysql://root:123456@10.50.8.44:3306/mydb' \
  -q "SELECT * FROM users" \
  -o users.json

# MySQL - 导出整个表（DDL + 数据）
db-cli export -c 'mysql://root:123456@10.50.8.44:3306/mydb' \
  -t users \
  -o users_dump.sql

# MySQL - 导出整个表为 JSON
db-cli export -c 'mysql://root:123456@10.50.8.44:3306/mydb' \
  -t users \
  -o users.json

# Dameng - 导出整个表（DDL + 数据）
db-cli export -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' \
  -t USERS \
  -o users_dump.sql

# Dameng - 导出查询结果为 JSON
db-cli export -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' \
  -q "SELECT * FROM USERS" \
  -o users.json
```

**专属 Flags:**

| Flag | 简写 | 说明 |
|------|------|------|
| `--query` | `-q` | SQL 查询语句 |
| `--table` | `-t` | 表名（导出结构 + 数据） |
| `--output` | `-o` | 输出文件路径（必需） |

支持格式：`.sql` (CREATE + INSERT), `.json`

注意：导出文件会根据后缀自动判断格式，必须指定 `-o/--output` 参数

---

### import

导入 SQL 或 JSON 文件

```bash
# MySQL - 导入 SQL 文件
db-cli import -c 'mysql://root:123456@10.50.8.44:3306/mydb' -f script.sql

# MySQL - 导入 JSON 文件（自动生成 INSERT 语句）
db-cli import -c 'mysql://root:123456@10.50.8.44:3306/mydb' -f data.json

# Dameng - 导入 SQL 文件
db-cli import -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' -f script.sql

# Dameng - 导入 JSON 文件（自动生成 INSERT 语句）
db-cli import -c 'dameng://SYSDBA:SYSDBA001@10.50.8.44:5236' -f data.json

# 事务模式导入（要么全部成功，要么全部回滚）
db-cli import -c 'mysql://root:123456@10.50.8.44:3306/mydb' -f data.sql --autocommit=false
```

**专属 Flags:**

| Flag | 简写 | 说明 |
|------|------|------|
| `--file` | `-f` | 输入文件路径（必需） |
| `--autocommit` | | 自动提交每条语句 | true |

支持格式：`.sql`, `.json`

注意：JSON 导入需要根据文件名推断表名（例如 `data.json` 会导入到 `data` 表）

---

### logs

查看命令历史和错误日志

```bash
# 查看所有日志
db-cli logs -c 'mysql://root:123456@10.50.8.44:3306/mydb'

# 只看历史
db-cli logs -c 'mysql://root:123456@10.50.8.44:3306/mydb' --type=history

# 只看错误
db-cli logs -c 'mysql://root:123456@10.50.8.44:3306/mydb' --type=errors

# JSON 格式输出
db-cli logs -c 'mysql://root:123456@10.50.8.44:3306/mydb' --format=json

# 限制显示条数
db-cli logs -c 'mysql://root:123456@10.50.8.44:3306/mydb' --last=10
```

**专属 Flags:**

| Flag | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--type` | | 日志类型：all, history, errors | all |
| `--format` | | 输出格式：table, json | table |
| `--last` | `-n` | 显示最近 N 条 | 20 |

---

## 全局 Flags

| Flag | 简写 | 说明 |
|------|------|------|
| `--connection` | `-c` | 数据库连接 URL |
| `--help` | `-?` | 显示帮助 |

---

## 数据库支持状态

| 功能 | MySQL | 达梦 (DM8) |
|------|-------|----------|
| version | ✅ | ✅ |
| exec | ✅ | ✅ |
| desc | ✅ | ✅ |
| export | ✅ | ✅ |
| import | ✅ | ✅ |
| logs | ✅ | ✅ |

---

## 测试环境

集成测试使用的数据库连接信息：

- **MySQL**: `mysql://root:123456@10.50.8.44:3306/mysql`
- **达梦 (DM8)**: `dameng://SYSDBA:SYSDBA001@10.50.8.44:5236`

---

## 许可证

MIT
