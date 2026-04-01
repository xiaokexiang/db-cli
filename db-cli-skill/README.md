# db-cli-skill - Claude Code Skill for Database Operations

A Model Context Protocol (MCP) server that enables Claude Code to perform database operations through the `db-cli` command-line tool.

## Quick Start

### 1. Install db-cli-skill and Download Binary

```bash
npx db-cli-skill install
```

This command will:
- Download the latest `db-cli` binary from GitHub Releases
- Install to `~/.db-cli/bin/db-cli` (macOS/Linux) or `%APPDATA%\.db-cli\bin\db-cli.exe` (Windows)
- Set executable permissions automatically

### 2. Configure Claude Code MCP

Add the following to your Claude Code settings:

**File:** `~/.claude/settings.json` (macOS/Linux) or `%APPDATA%\.claude\settings.json` (Windows)

```json
{
  "mcpServers": {
    "db-cli-skill": {
      "command": "npx",
      "args": ["-y", "db-cli-skill"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

### 3. Verify Installation

Restart Claude Code and verify:

```
/mcp list
```

You should see `db-cli-skill` in the list.

## Installation Options

### Install Specific Version

```bash
npx db-cli-skill install --version v1.0.0
```

### Force Reinstall

```bash
npx db-cli-skill install --force
```

### Check for Updates

```bash
npx db-cli-skill install --check
```

### Verify Installation

```bash
npx db-cli-skill install --verify
```

### Uninstall

```bash
npx db-cli-skill install --uninstall
```

## GitHub Personal Access Token (Optional)

For higher GitHub API rate limits, set a token:

1. Go to **GitHub Settings** > **Developer settings** > **Personal access tokens**
2. Create a token with `public_repo` scope
3. Set environment variable:

```bash
export GITHUB_TOKEN=your_token_here
```

## Features

The db-cli-skill exposes 5 tools for database operations:

| Tool | Description |
|------|-------------|
| `count` | Count rows in a database table |
| `desc` | Describe table structure (columns, types, constraints) |
| `export` | Export table data to JSON/CSV file |
| `import` | Import data from JSON/CSV file into table |
| `exec` | Execute raw SQL statements |

### Supported Databases

- **MySQL** (v5.7-8.x)
- **Dameng DM8** (达梦数据库)

## Supported Platforms

| Platform | Architecture | Binary Name |
|----------|--------------|-------------|
| Windows | x64 (amd64) | `db-cli-windows-amd64.exe` |
| Windows | ARM64 | `db-cli-windows-arm64.exe` |
| macOS | Intel (amd64) | `db-cli-darwin-amd64` |
| macOS | Apple Silicon (arm64) | `db-cli-darwin-arm64` |
| Linux | x64 (amd64) | `db-cli-linux-amd64` |
| Linux | ARM64 | `db-cli-linux-arm64` |

## Manual Installation (Alternative)

If you prefer to install `db-cli` manually:

### 1. Download Binary

Download from [GitHub Releases](https://github.com/xiaokexiang/database-cli/releases):

### 2. Install to Expected Location

**Windows:**
```powershell
# Create directory
mkdir -p $env:APPDATA\.db-cli\bin

# Place db-cli.exe in the directory
# Expected path: %APPDATA%\.db-cli\bin\db-cli.exe
```

**macOS/Linux:**
```bash
# Create directory
mkdir -p ~/.db-cli/bin

# Place db-cli binary and make executable
chmod +x ~/.db-cli/bin/db-cli
```

### 3. Install Skill

```bash
npm install -g @xiaokexiang/db-cli-skill
```

### 4. Configure Claude Code

Edit `~/.claude/settings.json` (macOS/Linux) or `%APPDATA%\.claude\settings.json` (Windows):

```json
{
  "mcpServers": {
    "db-cli-skill": {
      "command": "npx",
      "args": ["-y", "db-cli-skill"]
    }
  }
}
```

## Usage Examples

### Count Rows

**Natural Language:**
> "Count the number of users in the users table where status is active"

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret",
  "table": "users",
  "where": "status = 'active'"
}
```

### Describe Table

**Natural Language:**
> "Show me the structure of the products table"

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret",
  "table": "products"
}
```

### Export Data

**Natural Language:**
> "Export all orders to a CSV file"

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret",
  "table": "orders",
  "format": "csv",
  "output": "./exports/orders.csv"
}
```

### Import Data

**Natural Language:**
> "Import the customer data from the JSON file"

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret",
  "table": "customers",
  "input": "./imports/customers.json",
  "format": "json"
}
```

### Execute SQL

**Natural Language:**
> "Create a new index on the email column"

**Parameters:**
```json
{
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "secret",
  "sql": "CREATE INDEX idx_email ON users(email)"
}
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Run Built Server

```bash
npm start
```

## Architecture

```
db-cli-skill/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── cli/
│   │   └── install-cmd.ts    # Installation CLI command
│   ├── installer/
│   │   ├── download.ts       # GitHub Release downloader
│   │   └── install.ts        # Binary installation logic
│   ├── utils/
│   │   ├── binary-path.ts    # Binary path management
│   │   └── platform.ts       # Platform detection
│   └── templates/
│       ├── commands.ts       # Natural language command templates
│       └── matcher.ts        # Intent matching engine
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## CI/CD

This project uses GitHub Actions for automated builds and releases:

- **Trigger:** Push to `v*` tags
- **Platforms:** Windows/macOS/Linux x amd64/arm64
- **Output:** Release assets on GitHub Releases

## License

MIT
