# Architecture Patterns

**Domain:** Go-based database CLI tool
**Researched:** 2026-03-31

## Recommended Architecture

```
database-cli/
├── cmd/
│   └── db-cli/
│       └── main.go          # Entry point, CLI bootstrap
├── internal/
│   ├── cli/
│   │   ├── root.go          # Root command, global flags
│   │   ├── exec.go          # exec subcommand
│   │   ├── desc.go          # desc subcommand
│   │   ├── export.go        # export subcommand
│   │   └── import.go        # import subcommand
│   ├── database/
│   │   ├── connection.go    # Connection management, DSN building
│   │   ├── gorm.go          # GORM initialization, multiple DB support
│   │   └── types.go         # Database type enums, connection config
│   ├── executor/
│   │   ├── executor.go      # SQL execution engine
│   │   ├── file.go          # SQL file parsing, batch execution
│   │   └── transaction.go   # Transaction management
│   ├── output/
│   │   ├── formatter.go     # Output format interface
│   │   ├── json.go          # JSON formatter (default)
│   │   ├── table.go         # Table formatter
│   │   └── csv.go           # CSV formatter
│   ├── logger/
│   │   ├── logger.go        # Structured logging
│   │   └── history.go       # Command history (sanitized)
│   └── errors/
│       ├── errors.go        # Error types, error codes
│       └── messages.go      # Human-readable error messages
└── go.mod
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **cmd/** | Entry point, Cobra bootstrap | internal/cli/* |
| **cli/** | CLI parsing, flag handling, command routing | database/, executor/, output/ |
| **database/** | Connection management, GORM setup | — (called by executor) |
| **executor/** | SQL execution, transaction control, file processing | database/, output/, errors/ |
| **output/** | Result formatting (JSON/table/CSV) | — (called by cli/) |
| **logger/** | Structured logging, history recording | errors/ |
| **errors/** | Error type definitions, error code constants | — (used everywhere) |

### Data Flow

```
┌─────────────┐
│  User Input │ (CLI flags + subcommand)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  cmd/main   │ (Cobra bootstrap)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  cli/*      │ (Flag parsing, validation)
└──────┬──────┘
       │
       │  Build connection config from flags
       ▼
┌─────────────┐
│  database/  │ (DSN building, GORM init)
│  connection │
└──────┬──────┘
       │
       │  Return *gorm.DB
       ▼
┌─────────────┐
│  executor/  │ (SQL execution, transaction mgmt)
│  executor   │
└──────┬──────┘
       │
       │  Return raw sql.Rows or []map[string]interface{}
       ▼
┌─────────────┐
│  output/    │ (Format: JSON/table/CSV)
│  formatter  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   stdout    │ (Formatted output)
└─────────────┘

Error path:
executor/ → errors/ → logger/ → stderr (with error code)
```

## Patterns to Follow

### Pattern 1: Connection Factory

**What:** Build database connections through a factory that handles multiple database types

**When:** Supporting MySQL + 达梦 (DM) database with GORM

**Example:**
```go
// internal/database/types.go
type DBType string

const (
    DBTypeMySQL DBType = "mysql"
    DBTypeDM    DBType = "dm"
)

type ConnectionConfig struct {
    Host     string
    Port     int
    User     string
    Password string
    Database string
    Type     DBType
}

// internal/database/gorm.go
func NewConnection(cfg ConnectionConfig) (*gorm.DB, error) {
    switch cfg.Type {
    case DBTypeMySQL:
        return openMySQL(cfg)
    case DBTypeDM:
        return openDM(cfg)
    default:
        return nil, fmt.Errorf("unsupported database type: %s", cfg.Type)
    }
}

func openMySQL(cfg ConnectionConfig) (*gorm.DB, error) {
    dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
        cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
    return gorm.Open(mysql.Open(dsn), &gorm.Config{})
}

func openDM(cfg ConnectionConfig) (*gorm.DB, error) {
    // 达梦数据库 DSN 格式可能不同，需参考 dm-go-driver 文档
    dsn := buildDMDsn(cfg)
    return gorm.Open(dm.Open(dsn), &gorm.Config{})
}
```

### Pattern 2: Command-Executor Separation

**What:** CLI commands only handle parsing and routing; execution logic lives in separate package

**When:** Keeping CLI layer thin, enabling unit testing of execution logic

**Example:**
```go
// cmd/exec.go
var execCmd = &cobra.Command{
    Use:   "exec",
    Short: "Execute SQL statement or file",
    RunE: func(cmd *cobra.Command, args []string) error {
        cfg, err := database.NewConnectionConfigFromFlags(cmd)
        if err != nil {
            return err
        }

        db, err := database.NewConnection(cfg)
        if err != nil {
            return fmt.Errorf("failed to connect: %w", err)
        }

        exec := executor.New(db)

        if sqlFile != "" {
            return exec.ExecuteFile(sqlFile, autoCommit)
        }

        results, err := exec.Execute(sql)
        if err != nil {
            return err
        }

        return output.Print(results, outputFormat)
    },
}
```

### Pattern 3: Formatter Interface

**What:** Define output formatting as an interface with multiple implementations

**When:** Supporting JSON (default), table, and CSV output formats

**Example:**
```go
// internal/output/formatter.go
type Format interface {
    Format([]map[string]interface{}) (string, error)
}

type JSONFormat struct{}
type TableFormat struct{}
type CSVFormat struct{}

func (f *JSONFormat) Format(data []map[string]interface{}) (string, error) {
    b, err := json.MarshalIndent(data, "", "  ")
    return string(b), err
}

// internal/output/output.go
func Print(data []map[string]interface{}, format string) error {
    var f Format
    switch format {
    case "table":
        f = &TableFormat{}
    case "csv":
        f = &CSVFormat{}
    default:
        f = &JSONFormat{}
    }

    output, err := f.Format(data)
    if err != nil {
        return err
    }

    fmt.Println(output)
    return nil
}
```

### Pattern 4: Error Codes with Context

**What:** Define error codes for different failure modes, wrap errors with context

**When:** SQL execution needs to report specific error codes for automation

**Example:**
```go
// internal/errors/errors.go
type ErrorCode int

const (
    ErrUnknown ErrorCode = iota
    ErrConnectionFailed
    ErrSQLSyntax
    ErrTableNotFound
    ErrPermissionDenied
    ErrFileNotFound
    ErrTransactionFailed
)

type DBError struct {
    Code    ErrorCode
    Message string
    Cause   error
}

func (e *DBError) Error() string {
    return fmt.Sprintf("[%d] %s: %v", e.Code, e.Message, e.Cause)
}

// internal/executor/executor.go
func (e *Executor) Execute(sql string) ([]map[string]interface{}, error) {
    rows, err := e.db.Raw(sql).Rows()
    if err != nil {
        return nil, classifySQLError(err)
    }
    defer rows.Close()

    return scanRows(rows)
}

func classifySQLError(err error) *DBError {
    if strings.Contains(err.Error(), "syntax") {
        return &DBError{Code: ErrSQLSyntax, Message: "SQL syntax error", Cause: err}
    }
    if strings.Contains(err.Error(), "doesn't exist") {
        return &DBError{Code: ErrTableNotFound, Message: "Table not found", Cause: err}
    }
    return &DBError{Code: ErrUnknown, Message: "Database error", Cause: err}
}
```

### Pattern 5: SQL File Line-by-Line Execution

**What:** Parse SQL file, execute statements one by one, stop on error

**When:** SQL import scripts need atomic-like behavior without full transaction

**Example:**
```go
// internal/executor/file.go
func (e *Executor) ExecuteFile(path string, autoCommit bool) error {
    content, err := os.ReadFile(path)
    if err != nil {
        return &DBError{Code: ErrFileNotFound, Message: "SQL file not found", Cause: err}
    }

    statements := splitStatements(string(content))

    var tx *gorm.DB
    if !autoCommit {
        tx = e.db.Begin()
        defer func() {
            if r := recover(); r != nil {
                tx.Rollback()
            }
        }()
    } else {
        tx = e.db
    }

    for i, stmt := range statements {
        if strings.TrimSpace(stmt) == "" {
            continue
        }

        result := tx.Exec(stmt)
        if result.Error != nil {
            if !autoCommit {
                tx.Rollback()
            }
            return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
        }

        fmt.Printf("✓ Statement %d executed (%d rows affected)\n", i+1, result.RowsAffected)
    }

    if !autoCommit {
        if err := tx.Commit().Error; err != nil {
            return &DBError{Code: ErrTransactionFailed, Message: "Failed to commit", Cause: err}
        }
        fmt.Println("✓ Transaction committed")
    }

    return nil
}

func splitStatements(content string) []string {
    // Split by semicolon, handle multi-line statements
    // Consider comments, string literals, etc.
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic main.go

**What:** Putting all command logic in main.go or cmd/

**Why bad:** Untestable, hard to maintain, violates separation of concerns

**Instead:** Use cmd/ only for CLI bootstrap and flag parsing, move logic to internal/

### Anti-Pattern 2: Global Database Connection

**What:** Storing *gorm.DB as global variable

**Why bad:** Makes testing difficult, implicit dependencies, concurrent execution issues

**Instead:** Pass *gorm.DB as parameter to functions that need it (dependency injection)

### Anti-Pattern 3: Printing Directly from Executor

**What:** Calling fmt.Println() from executor/database packages

**Why bad:** Couples business logic to stdout, makes testing and output format changes hard

**Instead:** Return data from executor, let cli layer handle output via formatter

### Anti-Pattern 4: Ignoring Transaction State

**What:** Not tracking transaction state across multiple statement executions

**Why bad:** Can lead to partial commits, data inconsistency

**Instead:** Explicitly track transaction state, rollback on error, commit on success

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Concurrent CLI invocations | No issues (stateless) | No issues (stateless) | No issues (stateless) |
| SQL file size | <10MB OK | <50MB OK | Stream large files |
| Result set size | Load all to memory | Load all to memory | Pagination/streaming output |
| Connection pooling | Per-invocation OK | Per-invocation OK | Consider connection reuse |
| Logging volume | File logging OK | File + rotation needed | Structured logging (JSON) |

**Note:** CLI tools are inherently stateless per invocation, so scalability is mostly about handling large inputs/outputs gracefully.

## Build Order

Components must be built in this order (bottom-up):

```
1. internal/errors/        # No dependencies
2. internal/logger/        # Depends on errors/
3. internal/database/      # Depends on errors/
4. internal/output/        # No dependencies
5. internal/executor/      # Depends on database/, errors/, output/
6. internal/cli/           # Depends on all above
7. cmd/db-cli/             # Entry point, depends on cli/
```

**Development order:** Start with errors/, then database/ (connection only), then executor/ (basic exec), then cli/ (minimal command), then output/, then iterate.

## GORM Integration for Multi-Database Support

### Architecture

```
┌─────────────────────────────────────┐
│           cli/ (commands)           │
└─────────────────┬───────────────────┘
                  │
                  │ ConnectionConfig
                  ▼
┌─────────────────────────────────────┐
│        database/ (factory)          │
│  ┌─────────────────────────────┐    │
│  │  NewConnection(cfg)         │    │
│  │  ├─ MySQL → mysql.Open()    │    │
│  │  └─ DM    → dm.Open()       │    │
│  └─────────────────────────────┘    │
└─────────────────┬───────────────────┘
                  │
                  │ *gorm.DB (unified interface)
                  ▼
┌─────────────────────────────────────┐
│       executor/ (operations)        │
│  Uses GORM methods that work        │
│  across both databases              │
└─────────────────────────────────────┘
```

### Key Considerations

| Aspect | Approach |
|--------|----------|
| **Driver registration** | Import drivers with blank identifier: `_ "github.com/go-sql-driver/mysql"` |
| **GORM dialect** | GORM auto-detects dialect from driver, but verify for 达梦 |
| **Type mapping** | GORM handles Go type → DB type mapping; verify 达梦 compatibility |
| **Raw SQL** | Use `db.Raw()` for database-specific SQL (avoids ORM translation) |
| **Migration** | GORM AutoMigrate may not support 达梦; use raw DDL for DDL-01/02 |

### Potential Issues with 达梦 (DM) Database

| Issue | Mitigation |
|-------|------------|
| Driver availability | Verify dm-go-driver exists and is maintained; may need vendor fork |
| GORM compatibility | Test basic CRUD first; fall back to Raw() for complex queries |
| DSN format | 达梦 DSN format differs from MySQL; check driver documentation |
| Feature gaps | Some GORM features may not work; use raw SQL as fallback |

## Project Layout Rationale

| Directory | Purpose | Why Here |
|-----------|---------|----------|
| **cmd/db-cli/** | Single entry point | Standard Go convention; makes binary name obvious |
| **internal/cli/** | Subcommand definitions | Private to project, Cobra command structure |
| **internal/database/** | Connection factory | Private, encapsulates database-specific logic |
| **internal/executor/** | SQL execution engine | Private, core business logic |
| **internal/output/** | Formatters | Private, output concerns isolated |
| **internal/logger/** | Logging, history | Private, cross-cutting concern |
| **internal/errors/** | Error types | Private, used everywhere |

No **pkg/** directory needed: This project is a single application, not a library. Everything is internal to the CLI.

## Sources

- Standard Go project layout: [GitHub - golang-standards/project-layout](https://github.com/golang-standards/project-layout)
- Cobra framework documentation: [spf13/cobra README](https://github.com/spf13/cobra)
- GORM documentation: [gorm.io/docs](https://gorm.io/docs/)
- Go CLI best practices: Various community resources

**Confidence Assessment:**

| Area | Confidence | Notes |
|------|------------|-------|
| Component structure | HIGH | Based on standard Go CLI patterns (Cobra, gh, kubectl) |
| Data flow | HIGH | Standard CLI architecture |
| GORM integration | MEDIUM | GORM docs verified; 达梦 compatibility unverified |
| Error handling | HIGH | Standard Go error wrapping patterns |
| Build order | HIGH | Logical dependency analysis |
| Project layout | HIGH | Follows golang-standards/project-layout |
| 达梦 database specifics | LOW | Driver availability and GORM compatibility need validation |

**Research flags:**
- 达梦 (DM) database Go driver: Need to verify `dm-go-driver` exists and works with GORM
- GORM + 达梦 compatibility: May need raw SQL fallback for DDL operations
