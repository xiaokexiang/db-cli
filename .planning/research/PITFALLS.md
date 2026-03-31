# Domain Pitfalls

**Domain:** Go Database CLI Tools
**Researched:** 2026-03-31

---

## Critical Pitfalls

Mistakes that cause rewrites, security vulnerabilities, or major issues.

---

### Pitfall 1: SQL Injection via Dynamic Query Construction

**What goes wrong:** Building SQL queries through string concatenation with user input instead of using parameterized queries or GORM's query builder.

**Why it happens:**
- Convenience of string formatting (`fmt.Sprintf`) over prepared statements
- Misunderstanding that GORM's `Raw()` still requires parameterization
- Passing user input directly to `Where()` clauses without sanitization

**Consequences:**
- Complete database compromise
- Data exfiltration
- Compliance violations (especially in enterprise environments)

**Prevention:**
```go
// WRONG - SQL injection vulnerability
db.Raw(fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", userInput))

// CORRECT - Parameterized query
db.Raw("SELECT * FROM users WHERE name = ?", userInput)

// CORRECT - GORM query builder
db.Where("name = ?", userInput).Find(&users)
```

**Detection:**
- Code review for `fmt.Sprintf` + SQL keywords
- Grep for `Raw(` with string concatenation
- Static analysis tools (gosec, go-staticcheck)

**Phase mapping:** Phase 1 (Core Execution) - Address during `exec` command implementation

---

### Pitfall 2: Credential Exposure in Process Lists and Logs

**What goes wrong:** Passwords passed via CLI flags (`--password`) appear in:
- Process listings (`ps aux`, Task Manager)
- Shell history (`~/.bash_history`)
- System logs and audit trails

**Why it happens:**
- Design convenience over security
- Not understanding that CLI flags are visible to all processes on the system
- Logging connection strings without redaction

**Consequences:**
- Credential theft by other users on shared systems
- Passwords in CI/CD logs
- Compliance audit failures

**Prevention:**
```go
// Use password prompt for interactive mode
if password == "" {
    fmt.Print("Password: ")
    password, _ = term.ReadPassword(int(os.Stdin.Fd()))
}

// Redact passwords in all logging
func sanitizeDSN(dsn string) string {
    return regexp.MustCompile(`password=[^&]+`).ReplaceAllString(dsn, "password=***")
}

// Never log full connection strings
log.Printf("Connecting to %s@%s:%s/%s", user, host, port, database)
```

**Detection:**
- Run `ps aux` while CLI is executing - check if password visible
- Audit all log statements for DSN/connection string output
- Check error messages for credential leakage

**Phase mapping:** Phase 1 (Core Execution) - Address during connection handling setup

---

### Pitfall 3: GORM N+1 Query Problem

**What goes wrong:** Fetching related data in a loop instead of using eager loading, causing one query per row.

**Why it happens:**
- GORM's lazy loading by default
- Unfamiliarity with `Preload()` and `Joins()`
- Not recognizing the pattern in nested iteration

**Consequences:**
- 1000x more database round-trips than necessary
- Response times go from milliseconds to seconds
- Database connection pool exhaustion under load

**Prevention:**
```go
// WRONG - N+1 queries
var users []User
db.Find(&users)
for i := range users {
    db.Find(&users[i].Profile) // One query per user!
}

// CORRECT - Eager loading with Preload
db.Preload("Profile").Find(&users)

// CORRECT - For complex queries
db.Joins("LEFT JOIN profiles ON profiles.user_id = users.id").Find(&users)
```

**Detection:**
- Enable GORM SQL logging: `db.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Info)})`
- Look for repeated similar queries in logs
- Monitor query count vs. result count ratio

**Phase mapping:** Phase 1 (Core Execution) - Address during GORM setup and query patterns

---

### Pitfall 4: Missing Connection Pool Configuration

**What goes wrong:** Using default GORM connection pool settings which may be inappropriate for CLI usage patterns.

**Why it happens:**
- Default settings work for simple cases
- Not understanding `SetMaxIdleConns`, `SetMaxOpenConns`, `SetConnMaxLifetime`
- CLI tools assumed to be single-use so pooling doesn't matter

**Consequences:**
- Connection exhaustion when running multiple instances
- "Too many connections" errors from database
- Stale connections causing intermittent failures
- Connection leaks if `sql.DB` not properly closed

**Prevention:**
```go
sqlDB, err := db.DB()
if err != nil {
    return err
}

// CLI-specific pool settings (lower than server apps)
sqlDB.SetMaxIdleConns(2)        // Keep few idle connections
sqlDB.SetMaxOpenConns(10)       // Limit concurrent connections
sqlDB.SetConnMaxLifetime(5 * time.Minute)

// CRITICAL - Ensure cleanup
defer sqlDB.Close()
```

**Detection:**
- Monitor `SHOW PROCESSLIST` during CLI usage
- Check for "max_connections exceeded" errors
- Review `db.DB()` calls - is `Close()` deferred?

**Phase mapping:** Phase 1 (Core Execution) - Address during database connection initialization

---

### Pitfall 5: Transaction Handling Without Proper Rollback

**What goes wrong:** Starting transactions without deferred rollback, or committing on error paths.

**Why it happens:**
- Forgetting to call `Rollback()` when errors occur mid-transaction
- Not using `defer tx.Rollback()` pattern
- Calling `Commit()` before checking all operations succeeded

**Consequences:**
- Partial data writes (data corruption)
- Locked tables/rows until timeout
- Inconsistent state between MySQL and Dameng

**Prevention:**
```go
// CORRECT pattern - Always defer rollback
tx := db.Begin()
defer func() {
    if r := recover(); r != nil {
        tx.Rollback()
    }
}()

if err := tx.Create(&user).Error; err != nil {
    tx.Rollback()
    return err
}

if err := tx.Create(&profile).Error; err != nil {
    tx.Rollback()
    return err
}

return tx.Commit().Error
```

**Detection:**
- Code review for `Begin()` without matching `Rollback()` in error paths
- Check for `defer` statements after transaction start
- Monitor for long-running uncommitted transactions

**Phase mapping:** Phase 1 (Core Execution) - Address during `--autocommit` flag implementation

---

## Moderate Pitfalls

---

### Pitfall 6: Windows Line Endings Breaking SQL Import

**What goes wrong:** SQL files created on Windows have CRLF (`\r\n`) line endings, causing:
- SQL syntax errors (unexpected `\r` characters)
- String comparisons failing
- Error messages with confusing `^` pointers

**Why it happens:**
- SQL files edited on Windows (Notepad, some IDEs)
- Git auto-converting line endings
- Not normalizing input before parsing

**Consequences:**
- SQL import fails mysteriously
- Error messages point to wrong locations
- Cross-platform inconsistency

**Prevention:**
```go
// Normalize line endings before processing
func normalizeLineEndings(content string) string {
    return strings.ReplaceAll(content, "\r\n", "\n")
}

// Or split on any whitespace/newline combination
statements := strings.FieldsFunc(content, func(r rune) bool {
    return r == '\n' || r == '\r' || r == ';'
})
```

**Detection:**
- Test SQL import with files created on Windows
- Check for `\r` in error messages
- Use `file` command to detect CRLF

**Phase mapping:** Phase 2 (SQL Import/Export) - Address during `import` command implementation

---

### Pitfall 7: Path Separator Issues on Windows

**What goes wrong:** Hardcoding `/` in file paths instead of using `filepath.Join()` or `filepath.Clean()`.

**Why it happens:**
- Developers on macOS/Linux never notice the issue
- Windows supports `/` in some contexts but not all
- Not testing on Windows during development

**Consequences:**
- File not found errors on Windows
- Import/export commands fail silently
- Binary distribution broken on Windows

**Prevention:**
```go
// WRONG - Unix-specific
path := dir + "/" + filename

// CORRECT - Cross-platform
path := filepath.Join(dir, filename)
path = filepath.Clean(path)

// For output, consider filepath.ToSlash() for display
fmt.Println("Exported to:", filepath.ToSlash(path))
```

**Detection:**
- Run tests on Windows (GitHub Actions windows-latest)
- Search codebase for hardcoded `"/"` in path operations
- Test `import`/`export` with nested directory paths

**Phase mapping:** Phase 1 (Core Execution) - Address during file I/O setup

---

### Pitfall 8: MySQL vs Dameng SQL Dialect Incompatibility

**What goes wrong:** Assuming MySQL syntax works identically on Dameng (Oracle-compatible).

**Key differences:**
| Feature | MySQL | Dameng |
|---------|-------|--------|
| Quotes | Backticks (`) | Double quotes (") |
| LIMIT | `LIMIT 10` | `LIMIT 10` (supported in newer versions) |
| Auto-increment | `AUTO_INCREMENT` | `IDENTITY` |
| Date functions | `NOW()`, `DATE_FORMAT()` | `SYSDATE`, `TO_CHAR()` |
| Boolean | `TINYINT(1)` | `BIT` |

**Why it happens:**
- Testing only against MySQL
- Dameng compatibility added as afterthought
- GORM dialect switching not comprehensive

**Consequences:**
- Commands work on MySQL but fail on Dameng
- Silent data corruption (different type coercion)
- Exported SQL not portable between databases

**Prevention:**
```go
// Use GORM's identifier quoting
db.Migrator().AutoMigrate(&Table{})

// Avoid raw SQL when possible, or use dialect-aware helpers
func quoteIdentifier(name string, dialect string) string {
    switch dialect {
    case "mysql":
        return "`" + name + "`"
    case "dm":
        return `"` + name + `"`
    }
}

// Test both databases for every SQL feature
```

**Detection:**
- Integration tests against both MySQL and Dameng
- Flag any MySQL-specific functions in code review
- Check GORM config: `db.Dialector.Name()`

**Phase mapping:** Phase 1 (Core Execution) - Address during dual-database setup

---

### Pitfall 9: Unhelpful Error Messages for CLI Users

**What goes wrong:** Surfacing raw Go errors or database errors without context.

**Examples of bad errors:**
```
Error: dial tcp 10.50.13.41:3306: connectex: No connection could be made because the target machine actively refused it.
Error: Error 1045: Access denied for user 'root'@'localhost'
```

**Why it happens:**
- Bubbling up errors from deep in the stack
- Not translating technical errors to user context
- Default error formatting

**Consequences:**
- Users don't know how to fix the problem
- Support burden increases
- CLI feels unpolished and unreliable

**Prevention:**
```go
// Wrap errors with context
if err := db.Open(); err != nil {
    if strings.Contains(err.Error(), "connection refused") {
        return fmt.Errorf("cannot connect to database at %s:%d - verify the server is running and firewall allows connections", host, port)
    }
    if strings.Contains(err.Error(), "Access denied") {
        return fmt.Errorf("authentication failed for user '%s' - check username and password", user)
    }
    return fmt.Errorf("database connection failed: %w", err)
}
```

**Detection:**
- Run CLI with invalid inputs - are errors actionable?
- Ask non-developers to interpret error messages
- Check for raw error strings in output

**Phase mapping:** Phase 1 (Core Execution) - Address during error handling setup

---

### Pitfall 10: NULL Value Handling with Go Types

**What goes wrong:** Using non-nullable Go types (`string`, `int64`) for database columns that can be NULL.

**Why it happens:**
- Simpler type signatures
- Not anticipating NULL values in existing databases
- GORM's default behavior with pointers

**Consequences:**
- Scan errors when reading NULL values
- Data loss when writing (NULL becomes zero value)
- Inconsistent behavior between MySQL and Dameng

**Prevention:**
```go
// WRONG - Will fail on NULL
type User struct {
    Name  string  // What if NULL?
    Email string  // What if NULL?
}

// CORRECT - Use sql.Null* types
type User struct {
    Name  sql.NullString
    Email sql.NullString
}

// OR - Use pointers
type User struct {
    Name  *string
    Email *string
}

// OR - Use GORM's nullable types
type User struct {
    Name  gorm_datatypes.NullString
    Email gorm_datatypes.NullString
}
```

**Detection:**
- Check struct fields against actual schema (NULLable columns?)
- Test with deliberately NULL data
- Look for `Scan error` on nullable columns

**Phase mapping:** Phase 1 (Core Execution) - Address during data model definition

---

## Minor Pitfalls

---

### Pitfall 11: Timezone and Timestamp Handling

**What goes wrong:** MySQL stores DATETIME without timezone; Go's `time.Time` includes timezone.

**Consequences:**
- Timestamps shift when read in different timezones
- Comparison issues between MySQL and Dameng
- JSON serialization includes unexpected offset

**Prevention:**
```go
// MySQL DSN: parseTime=true&loc=Local
dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true&loc=Local", ...)

// Or normalize to UTC
func normalizeTime(t time.Time) time.Time {
    return t.UTC()
}
```

**Phase mapping:** Phase 1 (Core Execution)

---

### Pitfall 12: Missing Context Timeout for Long Queries

**What goes wrong:** Queries can hang indefinitely without timeout.

**Prevention:**
```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
db.WithContext(ctx).Exec(...)
```

**Phase mapping:** Phase 1 (Core Execution)

---

### Pitfall 13: Password in Help Text and Examples

**What goes wrong:** Example commands in `--help` show actual passwords or placeholder patterns that look real.

**Prevention:**
- Use `<password>` or `***` in help text
- Never show real credentials in examples

**Phase mapping:** Phase 1 (Core Execution)

---

### Pitfall 14: Binary Distribution Without Code Signing (Windows)

**What goes wrong:** Windows SmartScreen flags unsigned binaries as potentially malicious.

**Consequences:**
- Users see scary warnings
- Corporate IT blocks download
- Reduced trust in tool

**Prevention:**
- Code signing certificate for Windows releases
- Document expected hash in release notes

**Phase mapping:** Phase 3 (Distribution)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Connection Handling** | Credential exposure, pool misconfiguration | Redact DSN in logs, configure pool explicitly |
| **SQL Execution** | SQL injection, dialect incompatibility | Use parameterized queries, test both databases |
| **Transaction Support** | Missing rollback on error | Defer rollback pattern, comprehensive error paths |
| **SQL File Import** | Windows line endings, path separators | Normalize input, use filepath.Join() |
| **Query Results** | N+1 queries, NULL handling | Enable SQL logging, use Null* types |
| **Export/Import** | Cross-platform path issues, timestamp TZ | Test on all platforms, normalize times |
| **Binary Distribution** | Windows SmartScreen, missing dependencies | Static linking, document hash |

---

## Summary by Category

### Security Pitfalls (Highest Priority)
1. SQL injection via string concatenation
2. Credential exposure in process lists
3. Password logging without redaction

### GORM Pitfalls (High Priority)
1. N+1 query problem
2. Connection pool misconfiguration
3. Transaction rollback failures
4. NULL type mismatches

### CLI Pitfalls (Medium Priority)
1. Unhelpful error messages
2. Flag parsing edge cases (empty strings, special characters)
3. Missing input validation

### Cross-Platform Pitfalls (Medium Priority)
1. Windows line endings in SQL files
2. Path separator issues
3. Binary distribution trust

### Database-Specific Pitfalls (High Priority)
1. MySQL vs Dameng dialect differences
2. Timestamp/timezone handling
3. Identifier quoting differences

---

## Sources

- [GORM Documentation - Performance and Best Practices](https://gorm.io)
- [Go Database Best Practices](https://github.com/golang/go/wiki/SQLDrivers)
- [Cobra CLI Framework](https://github.com/spf13/cobra)
- [OWASP SQL Injection Prevention](https://owasp.org/www-community/attacks/SQL_Injection)
- [Dameng Database Documentation](http://www.dameng.com.cn/)
- Go community discussions on database connection pooling
- Cross-platform Go CLI development guides

---

**Confidence Assessment:**
- Security pitfalls: HIGH (well-documented, standard patterns)
- GORM pitfalls: HIGH (extensive community knowledge)
- CLI pitfalls: MEDIUM (generalized from CLI best practices)
- Cross-platform: MEDIUM (common issues, some verification needed)
- Dameng-specific: LOW (limited English documentation, emerging ecosystem)
