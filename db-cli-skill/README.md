# db-cli-skill - Claude Code Skill for Database Operations

A Model Context Protocol (MCP) server that enables Claude Code to perform database operations through the `db-cli` command-line tool.

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

## Prerequisites

### 1. Node.js Runtime

- Node.js v18.0 or higher
- npm package manager

Verify installation:
```bash
node --version
npm --version
```

### 2. db-cli Binary

Download the appropriate `db-cli` binary for your platform from the [GitHub Releases](https://github.com/xiaokexiang/database-cli/releases):

- **Windows**: `db-cli.exe`
- **macOS**: `db-cli` (Intel/Apple Silicon)
- **Linux**: `db-cli` (x64/ARM64)

Install to the expected location:

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

### 3. GitHub Personal Access Token (Optional)

For automatic release downloads, set a GitHub token:

1. Go to GitHub Settings -> Developer settings -> Personal access tokens
2. Create a token with `public_repo` scope
3. Set environment variable:
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

## Installation

### Clone the Repository

```bash
git clone https://github.com/xiaokexiang/db-cli-skill.git
cd db-cli-skill
```

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

## Claude Code Configuration

Add the MCP server to your Claude Code configuration.

### Option 1: Global Configuration

Edit `~/.claude/settings.json` (macOS/Linux) or `%APPDATA%\.claude\settings.json` (Windows):

```json
{
  "mcpServers": {
    "db-cli-skill": {
      "command": "node",
      "args": ["/absolute/path/to/db-cli-skill/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Option 2: Project Configuration

Create `.claude/settings.json` in your project root:

```json
{
  "mcpServers": {
    "db-cli-skill": {
      "command": "node",
      "args": ["./path/to/db-cli-skill/dist/index.js"]
    }
  }
}
```

### Verify Installation

After configuration, restart Claude Code and verify the MCP server is connected:

```
/mcp list
```

You should see `db-cli-skill` in the list.

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
│   ├── server/
│   │   └── mcp-server.ts     # Server configuration and tools
│   └── utils/
│       └── binary-path.ts    # Binary location management
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
