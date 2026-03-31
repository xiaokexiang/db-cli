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
			return NewExecutionError(
				"failed to execute query",
				1,
				result.Error,
			)
		}

		// Scan rows directly using output.ScanRows which accepts *sql.Rows
		rows, err := result.Rows()
		if err != nil {
			return NewExecutionError(
				"failed to get rows",
				1,
				err,
			)
		}
		defer rows.Close()

		// Format and output results
		if formatErr := formatOutput(rows, format); formatErr != nil {
			return NewExecutionError(
				"failed to format output",
				1,
				formatErr,
			)
		}
		return nil
	} else {
		// Execute non-SELECT statement (INSERT, UPDATE, DELETE, DDL, etc.)
		result := db.Exec(sql)
		if result.Error != nil {
			return NewExecutionError(
				"failed to execute statement",
				1,
				result.Error,
			)
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
		return NewExecutionError(
			"failed to read SQL file",
			1,
			err,
		)
	}

	// Parse SQL statements with line number tracking
	statements := parseSQLStatementsWithLines(string(content))

	if len(statements) == 0 {
		return NewExecutionError(
			"no SQL statements found in file",
			1,
			nil,
		)
	}

	// Execute statements
	var lastRows *gorm.DB
	statementCount := 0

	if autocommit {
		// Each statement runs in its own implicit transaction
		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt.SQL)
			if stmtSQL == "" {
				continue
			}

			if isSelectQuery(stmtSQL) {
				// For SELECT, store last result for output
				lastRows = db.Raw(stmtSQL)
				if lastRows.Error != nil {
					return NewExecutionErrorWithLine(
						fmt.Sprintf("statement %d failed", i+1),
						1,
						lastRows.Error,
						stmt.Line,
						stmtSQL,
					)
				}
			} else {
				// Non-SELECT: just execute
				result := db.Exec(stmtSQL)
				if result.Error != nil {
					return NewExecutionErrorWithLine(
						fmt.Sprintf("statement %d failed", i+1),
						1,
						result.Error,
						stmt.Line,
						stmtSQL,
					)
				}
				statementCount++
			}
		}
	} else {
		// Wrap ALL statements in a single transaction
		tx := db.Begin()
		if tx.Error != nil {
			return NewExecutionError(
				"failed to begin transaction",
				1,
				tx.Error,
			)
		}

		// Execute all statements within the transaction
		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt.SQL)
			if stmtSQL == "" {
				continue
			}

			if isSelectQuery(stmtSQL) {
				lastRows = tx.Raw(stmtSQL)
				if lastRows.Error != nil {
					tx.Rollback()
					return NewExecutionErrorWithLine(
						fmt.Sprintf("statement %d failed", i+1),
						1,
						lastRows.Error,
						stmt.Line,
						stmtSQL,
					)
				}
			} else {
				result := tx.Exec(stmtSQL)
				if result.Error != nil {
					tx.Rollback()
					return NewExecutionErrorWithLine(
						fmt.Sprintf("statement %d failed", i+1),
						1,
						result.Error,
						stmt.Line,
						stmtSQL,
					)
				}
				statementCount++
			}
		}

		// Commit transaction only if all statements succeed
		if commitErr := tx.Commit().Error; commitErr != nil {
			return NewExecutionError(
				"failed to commit transaction",
				1,
				commitErr,
			)
		}
	}

	// Output results for last SELECT if any
	if lastRows != nil {
		rows, err := lastRows.Rows()
		if err == nil {
			defer rows.Close()
			if formatErr := formatOutput(rows, format); formatErr != nil {
				return NewExecutionError(
					"failed to format output",
					1,
					formatErr,
				)
			}
		}
	}

	fmt.Printf("Successfully executed %d statement(s)\n", statementCount)
	return nil
}

// StatementWithLine holds a SQL statement with its starting line number
type StatementWithLine struct {
	SQL  string
	Line int
}

// parseSQLStatementsWithLines splits SQL content into individual statements with line numbers
func parseSQLStatementsWithLines(content string) []StatementWithLine {
	lines := strings.Split(content, "\n")
	var statements []StatementWithLine
	var currentStmt strings.Builder
	startLine := 1
	currentLine := 1

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Track the start line of the current statement
		if currentStmt.Len() == 0 && trimmedLine != "" {
			startLine = currentLine
		}

		// Check if this line contains a semicolon (statement delimiter)
		if strings.Contains(line, ";") {
			// Add content before semicolon
			parts := strings.SplitN(line, ";", 2)
			currentStmt.WriteString(parts[0])

			stmt := strings.TrimSpace(currentStmt.String())
			if stmt != "" {
				statements = append(statements, StatementWithLine{
					SQL:  stmt,
					Line: startLine,
				})
			}

			// Reset for next statement
			currentStmt.Reset()
			if len(parts) > 1 && strings.TrimSpace(parts[1]) != "" {
				currentStmt.WriteString(parts[1])
				startLine = currentLine
			}
		} else {
			// No semicolon, continue building the statement
			if currentStmt.Len() > 0 {
				currentStmt.WriteString("\n")
			}
			currentStmt.WriteString(line)
		}

		currentLine++
	}

	// Handle any remaining statement without trailing semicolon
	stmt := strings.TrimSpace(currentStmt.String())
	if stmt != "" {
		statements = append(statements, StatementWithLine{
			SQL:  stmt,
			Line: startLine,
		})
	}

	return statements
}

// parseSQLStatements splits SQL content into individual statements (legacy, for backward compatibility)
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
