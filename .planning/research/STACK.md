# Technology Stack

**Project:** db-cli (Go database CLI tool)
**Researched:** 2026-03-31

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

```bash
# Initialize Go module
go mod init github.com/yourorg/db-cli

# Core CLI framework
go get github.com/spf13/cobra@v1.10.2

# ORM layer
go get gorm.io/gorm@latest

# MySQL driver
go get github.com/go-sql-driver/mysql@v1.9.3

# Dameng driver (verify import path - may require CGO)
# Option 1: Official dm-go-driver (if available on GitHub)
go get github.com/cherishlee/dm_go_driver  # Verify actual path

# Optional: structured logging
go get go.uber.org/zap@latest
# OR
go get github.com/rs/zerolog@latest
```

## GORM Multi-Database Configuration

```go
package main

import (
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
    // "github.com/cherishlee/dm_go_driver" // Dameng driver
)

// Database type enum
type DBType string

const (
    MySQL  DBType = "mysql"
    Dameng DBType = "dameng"
)

// ConnectionConfig holds database connection parameters
type ConnectionConfig struct {
    Host     string
    Port     int
    User     string
    Password string
    Database string
    Type     DBType
}

// NewDatabase creates a GORM connection based on type
func NewDatabase(cfg ConnectionConfig) (*gorm.DB, error) {
    switch cfg.Type {
    case MySQL:
        dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
            cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
        return gorm.Open(mysql.Open(dsn), &gorm.Config{})

    case Dameng:
        // DSN format depends on driver - verify with dm-go-driver docs
        dsn := fmt.Sprintf("dm://%s:%s@%s:%d/%s",
            cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database)
        return gorm.Open(dmsql.Open(dsn), &gorm.Config{})

    default:
        return nil, fmt.Errorf("unsupported database type: %s", cfg.Type)
    }
}
```

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

```bash
# Windows (amd64)
GOOS=windows GOARCH=amd64 go build -o db-cli.exe .

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -o db-cli-macos-intel .

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -o db-cli-macos-arm .

# Linux (amd64)
GOOS=linux GOARCH=amd64 go build -o db-cli-linux .
```

### Dameng Driver CGO Considerations

**Critical:** If `dm-go-driver` requires CGO (likely, as Dameng provides C client libraries):

1. **Cross-compilation becomes complex** - CGO requires target platform's C toolchain
2. **Static binaries not possible** - End users need Dameng client libraries installed
3. **Alternative approaches:**
   - Build separate binaries per platform with bundled dependencies
   - Use pure-Go Dameng driver if available (verify `dm8_go_driver` or similar)
   - Document that Dameng support requires local Dameng client installation

**Recommendation:** Investigate if a pure-Go Dameng driver exists. If not, consider:
- MySQL-first approach with Dameng as "advanced" feature requiring CGO build
- Static compilation with `-ldflags="-extldflags '-static'"` where possible

### GitHub Actions CI/CD Setup

```yaml
# .github/workflows/release.yml
build:
  strategy:
    matrix:
      goos: [linux, windows, darwin]
      goarch: [amd64, arm64]
      exclude:
        - goos: darwin
          goarch: 386  # No 32-bit macOS support

  env:
    GOOS: ${{ matrix.goos }}
    GOARCH: ${{ matrix.goarch }}
    CGO_ENABLED: 0  # For pure-Go builds (may not work with Dameng)
```

## Version Recommendations (Summary)

| Package | Version | Go Mod Command |
|---------|---------|----------------|
| cobra | v1.10.2 | `go get github.com/spf13/cobra@v1.10.2` |
| GORM | v1.30+ (latest) | `go get gorm.io/gorm@latest` |
| go-sql-driver/mysql | v1.9.3 | `go get github.com/go-sql-driver/mysql@v1.9.3` |
| dm-go-driver | Latest available | `go get github.com/cherishlee/dm_go_driver` (verify path) |
| pflag | Bundled with Cobra | (no separate install needed) |

## Dameng Driver Research Status ⚠️

**Confidence: LOW** - Requires validation

The following Dameng Go drivers were found in search results but need verification:

1. **dm-go-driver** - Check GitHub for official repository
2. **dm8_go_driver** - May be community-maintained
3. **cherishlee/dm_go_driver** - Referenced in search results

**Action required:**
- Verify the correct import path and CGO requirements
- Test if GORM integration works with discovered driver
- If CGO required, document build dependencies per platform

## Sources

- [Cobra v1.10.2 Release](https://github.com/spf13/cobra/releases/tag/v1.10.2) - HIGH confidence
- [go-sql-driver/mysql v1.9.3](https://github.com/go-sql-driver/mysql/releases/tag/v1.9.3) - HIGH confidence
- [urfave/cli v3.8.0](https://github.com/urfave/cli/releases/tag/v3.8.0) - HIGH confidence
- GORM documentation - MEDIUM confidence (web fetch blocked, based on search results)
- Dameng driver availability - LOW confidence (requires hands-on verification)
