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

var execCmd = &cobra.Command{
	Use:   "exec [flags] '<SQL>'",
	Short: "Execute SQL statements",
	Long: `Execute SQL statements against the database.

Supports single SQL statements or SQL files.
Query results are output as JSON by default.

Examples:
  # Execute a single SQL statement
  db-cli exec -h localhost -u root -p password -d mydb 'SELECT * FROM users'

  # Execute SQL from a file
  db-cli exec -h localhost -u root -p password -d mydb --file=script.sql

  # Change output format
  db-cli exec -h localhost -u root -p password -d mydb --format=table 'SELECT * FROM users'`,
	Args: cobra.MaximumNArgs(1),
	RunE: runExec,
}

var (
	execFile       string
	execFormat     string
	execAutocommit bool
)

func init() {
	// Add exec command to root
	rootCmd.AddCommand(execCmd)

	// Define flags
	execCmd.Flags().StringVarP(&execFile, "file", "f", "", "SQL file to execute")
	execCmd.Flags().StringVarP(&execFormat, "format", "", "json", "Output format: json, table, csv")
	execCmd.Flags().BoolVarP(&execAutocommit, "autocommit", "", true, "Auto-commit each SQL statement")
}

// runExec is the main execution logic for the exec command
func runExec(cmd *cobra.Command, args []string) error {
	// Validate: either SQL argument or --file flag must be provided, not both
	hasSQL := len(args) > 0 && args[0] != ""
	hasFile := execFile != ""

	if hasSQL && hasFile {
		return fmt.Errorf("cannot specify both SQL argument and --file flag")
	}

	if !hasSQL && !hasFile {
		return fmt.Errorf("must specify either SQL argument or --file flag")
	}

	// Validate format option
	if execFormat != "json" && execFormat != "table" && execFormat != "csv" {
		return fmt.Errorf("invalid format '%s': must be json, table, or csv", execFormat)
	}

	// Validate required connection parameters
	if cfg.User == "" {
		return fmt.Errorf("user is required (use -u or --user)")
	}
	if cfg.Database == "" {
		return fmt.Errorf("database is required (use -d or --database)")
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

	if hasSQL {
		// Execute single SQL statement
		return executeSingleSQL(db, args[0], execFormat)
	}

	// Execute SQL file
	return executeSQLFile(db, execFile, execFormat, execAutocommit)
}

// executeSingleSQL executes a single SQL statement and outputs the result
func executeSingleSQL(db *gorm.DB, sql string, format string) error {
	sql = strings.TrimSpace(sql)

	// Check if it's a SELECT query (returns rows)
	isSelect := isSelectQuery(sql)

	if isSelect {
		// Execute query and get rows
		result := db.Raw(sql)
		if result.Error != nil {
			return fmt.Errorf("failed to execute query: %w", result.Error)
		}

		// Scan rows directly using output.ScanRows which accepts *sql.Rows
		rows, err := result.Rows()
		if err != nil {
			return fmt.Errorf("failed to get rows: %w", err)
		}
		defer rows.Close()

		// Format and output results
		return formatOutput(rows, format)
	} else {
		// Execute non-SELECT statement (INSERT, UPDATE, DELETE, DDL, etc.)
		result := db.Exec(sql)
		if result.Error != nil {
			return fmt.Errorf("failed to execute statement: %w", result.Error)
		}

		// Output rows affected
		fmt.Printf("Query OK, %d row(s) affected\n", result.RowsAffected)
		return nil
	}
}

// executeSQLFile executes SQL statements from a file
func executeSQLFile(db *gorm.DB, filePath string, format string, autocommit bool) error {
	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read SQL file: %w", err)
	}

	// Parse SQL statements (split by semicolon)
	statements := parseSQLStatements(string(content))

	if len(statements) == 0 {
		return fmt.Errorf("no SQL statements found in file")
	}

	// Execute statements
	var lastRows *gorm.DB
	statementCount := 0

	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		if autocommit {
			// Each statement is auto-committed
			if isSelectQuery(stmt) {
				// For SELECT, store last result for output
				lastRows = db.Raw(stmt)
				if lastRows.Error != nil {
					return fmt.Errorf("statement %d failed: %w", i+1, lastRows.Error)
				}
			} else {
				// Non-SELECT: just execute
				result := db.Exec(stmt)
				if result.Error != nil {
					return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
				}
				statementCount++
			}
		} else {
			// Wrap all statements in a single transaction
			tx := db.Begin()
			if tx.Error != nil {
				return fmt.Errorf("failed to begin transaction: %w", tx.Error)
			}

			if isSelectQuery(stmt) {
				lastRows = tx.Raw(stmt)
				if lastRows.Error != nil {
					tx.Rollback()
					return fmt.Errorf("statement %d failed: %w", i+1, lastRows.Error)
				}
			} else {
				result := tx.Exec(stmt)
				if result.Error != nil {
					tx.Rollback()
					return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
				}
				statementCount++
			}

			// Commit transaction
			if commitErr := tx.Commit().Error; commitErr != nil {
				return fmt.Errorf("failed to commit transaction: %w", commitErr)
			}
		}
	}

	// Output results for last SELECT if any
	if lastRows != nil {
		rows, err := lastRows.Rows()
		if err == nil {
			defer rows.Close()
			return formatOutput(rows, format)
		}
	}

	fmt.Printf("Successfully executed %d statement(s)\n", statementCount)
	return nil
}

// parseSQLStatements splits SQL content into individual statements
func parseSQLStatements(content string) []string {
	// Simple split by semicolon
	// TODO: Handle semicolons inside strings properly
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
func formatOutput(rows *sql.Rows, format string) error {
	switch format {
	case "json":
		return outputJSON(rows)
	case "table":
		return outputTable(rows)
	case "csv":
		return outputCSV(rows)
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

// outputTable outputs query results as ASCII table (placeholder)
func outputTable(rows *sql.Rows) error {
	// TODO: Implement table formatter
	return fmt.Errorf("table format not yet implemented")
}

// outputCSV outputs query results as CSV (placeholder)
func outputCSV(rows *sql.Rows) error {
	// TODO: Implement CSV formatter
	return fmt.Errorf("csv format not yet implemented")
}
