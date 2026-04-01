## Project

**db-cli**

一个 Node.js/TypeScript 跨平台数据库 CLI 工具，支持 MySQL 数据库。提供 SQL 执行、schema 查看、数据导入导出功能。

**Core Value:** 让用户通过自然语言或简单命令即可完成数据库操作，无需记忆复杂的 SQL 语法和连接参数，同时保持对数据库的完全控制。

### Constraints

- **[数据库]**: MySQL 已支持 — 达梦数据库 (DM8) 计划在未来支持（需要稳定的 Node.js 驱动）
- **[跨平台]**: Windows/macOS/Linux 都需要支持 — 用户开发环境多样
- **[无配置]**: 不存储连接信息 — 安全考虑，每次手动指定
- **[DSN URL]**: 只使用 `-c` flag 指定连接信息 — 简洁统一

## Technology Stack

### Runtime
| Technology | Version | Purpose |
|------------|---------|---------|---------|
| **Node.js** | >=18.0.0 | Runtime environment |
| **TypeScript** | ^5.8.3 | Type-safe JavaScript |

### Core CLI Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **commander** | ^14.0.3 | CLI framework | Most popular Node.js CLI framework. Simple API, automatic help generation, subcommand support, argument parsing. |

### Database Driver
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **mysql2** | ^3.20.0 | MySQL driver | Official MySQL driver for Node.js. Promise-based API, prepared statements, connection pooling. |

### Utilities
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **cli-table3** | ^0.6.5 | ASCII table output | Beautiful table formatting for query results. |

## Project Structure

```
db-cli/
├── src/
│   ├── index.ts              # Main entry point
│   ├── cmd/                  # Command implementations
│   │   ├── index.ts          # Command exports
│   │   ├── exec.ts           # SQL execution command
│   │   ├── desc.ts           # Schema inspection command
│   │   ├── import.ts         # SQL/JSON import command
│   │   └── export.ts         # Data export command
│   └── internal/
│       ├── database/
│       │   ├── config.ts     # DSN parsing and config
│       │   └── connection.ts # Database connection wrapper
│       └── output/
│           └── formatter.ts  # Output formatters (table/json/sql)
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run
node dist/index.js [command]

# Or install globally
npm link
```

## Commands

| Command | Description |
|---------|-------------|
| `exec [options] <sql>` | Execute SQL statements |
| `desc [options]` | Describe database schema |
| `import [options]` | Import data from SQL or JSON file |
| `export [options]` | Export database data |

## DSN URL Format

```
<type>://<user>:<password>@<host>:<port>[/<database>]
```

**Examples:**

```bash
# MySQL
db-cli exec -c 'mysql://root:password@localhost:3306/mydb' 'SELECT * FROM users'

# Password with special characters (@ encoded as %40)
db-cli exec -c 'mysql://root:p%40ssword@localhost:3306/mydb' 'SELECT 1'
```

## Build Commands

```bash
npm run build     # Compile TypeScript
npm run dev       # Run with ts-node (development)
npm start         # Run compiled version
npm run clean     # Remove dist folder
```

## Notes

- **Dameng (DM8) Support**: Not yet available in Node.js version. No stable Node.js driver exists. Use the Go version (previous release) if Dameng support is required.
- **Output Formats**: table (default), json, sql (INSERT statements)
- **Transaction Support**: `--autocommit=false` for transaction mode
