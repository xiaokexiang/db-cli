package cmd

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/database"
	"github.com/xiaokexiang/db-cli/internal/output"
	"gorm.io/gorm"
)

var (
	execFormat     string
	execAutocommit bool
)

var execCmd = &cobra.Command{
	Use:   "exec [flags] '<SQL>'",
	Short: "Execute SQL statements",
	Long: `Execute SQL statements against the database.

Supports single SQL statement or multiple statements separated by semicolons.
Query results are output as table by default.

Supported output formats:
  - table: Output query results as ASCII table (default)
  - json: Output query results as JSON
  - sql: Generate INSERT statements from query results

Examples:
  # Execute a single SQL statement
  db-cli exec -c <dsn> 'SELECT * FROM users'

  # Execute with table output
  db-cli exec -c <dsn> --format=table 'SELECT * FROM users'

  # Execute and generate INSERT statements
  db-cli exec -c <dsn> --format=sql 'SELECT * FROM users'

  # Execute multiple statements
  db-cli exec -c <dsn> 'SELECT 1; SELECT 2; SELECT 3'

  # Execute without autocommit (transaction mode)
  db-cli exec -c <dsn> --autocommit=false 'INSERT INTO users VALUES (1, "test")'`,
	Args: cobra.ExactArgs(1),
	RunE: runExec,
}

func init() {
	// Add exec command to root
	rootCmd.AddCommand(execCmd)

	// Define flags
	execCmd.Flags().StringVarP(&execFormat, "format", "", "table", "Output format: json, table, sql (for SELECT queries)")
	execCmd.Flags().BoolVarP(&execAutocommit, "autocommit", "", true, "Auto-commit each SQL statement")
}

// runExec is the main execution logic for the exec command
func runExec(cmd *cobra.Command, args []string) error {
	sql := args[0]
	if sql == "" {
		return fmt.Errorf("SQL statement cannot be empty")
	}

	// Validate format option
	if execFormat != "json" && execFormat != "table" && execFormat != "sql" {
		return fmt.Errorf("invalid format '%s': must be json, table, or sql", execFormat)
	}

	// Validate required connection parameters
	if cfg.User == "" {
		return fmt.Errorf("user is required")
	}

	// Test database connection before opening
	if err := database.TestConnection(cfg); err != nil {
		return fmt.Errorf("database connection test failed: %w", err)
	}

	// Open database connection
	db, err := database.OpenConnection(cfg)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}
	defer func() {
		if closeErr := database.CloseConnection(db); closeErr != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to close connection: %v\n", closeErr)
		}
	}()

	// Parse SQL statements
	statements := parseSQLStatements(sql)

	if len(statements) == 0 {
		return fmt.Errorf("no SQL statements found")
	}

	// Execute statements
	var lastRows *gorm.DB
	statementCount := 0

	if execAutocommit {
		// Each statement runs in its own implicit transaction
		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt)
			if stmtSQL == "" {
				continue
			}

			if isSelectQuery(stmtSQL) {
				// For SELECT, store last result for output
				lastRows = db.Raw(stmtSQL)
				if lastRows.Error != nil {
					return fmt.Errorf("statement %d failed: %w", i+1, lastRows.Error)
				}
			} else {
				// Non-SELECT: just execute
				result := db.Exec(stmtSQL)
				if result.Error != nil {
					return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
				}
				statementCount++
			}
		}
	} else {
		// Wrap ALL statements in a single transaction
		tx := db.Begin()
		if tx.Error != nil {
			return fmt.Errorf("failed to begin transaction: %w", tx.Error)
		}

		// Execute all statements within the transaction
		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt)
			if stmtSQL == "" {
				continue
			}

			if isSelectQuery(stmtSQL) {
				lastRows = tx.Raw(stmtSQL)
				if lastRows.Error != nil {
					tx.Rollback()
					return fmt.Errorf("statement %d failed: %w", i+1, lastRows.Error)
				}
			} else {
				result := tx.Exec(stmtSQL)
				if result.Error != nil {
					tx.Rollback()
					return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
				}
				statementCount++
			}
		}

		// Commit transaction only if all statements succeed
		if commitErr := tx.Commit().Error; commitErr != nil {
			return fmt.Errorf("failed to commit transaction: %w", commitErr)
		}
	}

	// Output results for last SELECT if any
	if lastRows != nil {
		rows, err := lastRows.Rows()
		if err == nil {
			defer rows.Close()
			if err := formatOutput(rows, execFormat, db); err != nil {
				return fmt.Errorf("failed to format output: %w", err)
			}
		}
	}

	if statementCount > 0 {
		fmt.Printf("Successfully executed %d statement(s)\n", statementCount)
	}

	return nil
}

// parseSQLStatements splits SQL content into individual statements
func parseSQLStatements(content string) []string {
	// Split by semicolon
	statements := strings.Split(content, ";")
	result := make([]string, 0, len(statements))
	for _, stmt := range statements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// isSelectQuery checks if a SQL statement is a SELECT query
func isSelectQuery(sql string) bool {
	upper := strings.ToUpper(strings.TrimSpace(sql))
	return strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "SHOW") || strings.HasPrefix(upper, "DESCRIBE")
}

// formatOutput formats and prints query results
func formatOutput(rows *sql.Rows, format string, db *gorm.DB) error {
	switch format {
	case "json":
		return outputJSON(rows)
	case "table":
		return outputTable(rows)
	case "sql":
		return outputSQL(rows, db)
	default:
		return outputJSON(rows)
	}
}

// outputJSON outputs query results as JSON
func outputJSON(rows *sql.Rows) error {
	data, err := output.ScanRows(rows)
	if err != nil {
		return fmt.Errorf("failed to scan rows: %w", err)
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}

// outputTable outputs query results as ASCII table
func outputTable(rows *sql.Rows) error {
	result, err := output.ToTable(rows)
	if err != nil {
		return fmt.Errorf("failed to format table: %w", err)
	}
	fmt.Println(result)
	return nil
}

// outputSQL outputs query results as INSERT statements
func outputSQL(rows *sql.Rows, db *gorm.DB) error {
	// Detect database type
	dbType := "mysql"
	if db != nil {
		dia := db.Dialector.Name()
		if strings.Contains(strings.ToLower(dia), "dameng") || strings.Contains(strings.ToLower(dia), "dm") {
			dbType = "dameng"
		}
	}

	data, err := output.ToInsertForDB(rows, "query_result", dbType)
	if err != nil {
		return fmt.Errorf("failed to generate INSERT statements: %w", err)
	}

	if data == "" {
		fmt.Println("-- Query returned no results")
		return nil
	}

	fmt.Println(data)
	return nil
}
