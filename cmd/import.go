package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/database"
	"gorm.io/gorm"
)

var importFile string

var importCmd = &cobra.Command{
	Use:   "import [flags]",
	Short: "Import data from SQL or JSON file",
	Long: `Import and execute statements from a SQL or JSON file.

For SQL files: executes all SQL statements in the file.
For JSON files: generates INSERT statements from JSON array data.

Examples:
  # Import SQL file
  db-cli import -c <dsn> -f data.sql

  # Import JSON file (generates INSERT statements)
  db-cli import -c <dsn> -f data.json

  # Import SQL file without autocommit (transaction mode)
  db-cli import -c <dsn> -f data.sql --autocommit=false`,
	RunE: runImport,
}

func init() {
	// Add import command to root
	rootCmd.AddCommand(importCmd)

	// Define flags
	importCmd.Flags().StringVarP(&importFile, "file", "f", "", "Input file path (.sql or .json)")
	importCmd.Flags().BoolVarP(&execAutocommit, "autocommit", "", true, "Auto-commit each SQL statement")

	// Mark file flag as required
	importCmd.MarkFlagRequired("file")
}

// runImport is the main import logic
func runImport(cmd *cobra.Command, args []string) error {
	// Validate file extension
	if importFile == "" {
		return fmt.Errorf("--file is required")
	}
	ext := strings.ToLower(filepath.Ext(importFile))
	if ext != ".sql" && ext != ".json" {
		return fmt.Errorf("unsupported file format '%s': use .sql or .json extension", ext)
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

	// Route based on file extension
	if ext == ".sql" {
		return importSQLFile(db, importFile, execAutocommit)
	} else {
		return importJSONFile(db, importFile, execAutocommit)
	}
}

// importSQLFile imports and executes SQL from a file
func importSQLFile(db *gorm.DB, filePath string, autocommit bool) error {
	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read SQL file: %w", err)
	}

	// Remove SQL comments (lines starting with --)
	lines := strings.Split(string(content), "\n")
	var cleanedLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "--") && trimmed != "" {
			cleanedLines = append(cleanedLines, line)
		}
	}
	cleanedContent := strings.Join(cleanedLines, "\n")

	// Parse SQL statements
	statements := parseSQLStatements(cleanedContent)
	if len(statements) == 0 {
		return fmt.Errorf("no SQL statements found in file")
	}

	// Execute statements
	statementCount := 0

	if autocommit {
		// Each statement runs in its own implicit transaction
		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt)
			if stmtSQL == "" {
				continue
			}

			result := db.Exec(stmtSQL)
			if result.Error != nil {
				return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
			}
			statementCount++
		}
	} else {
		// Wrap ALL statements in a single transaction
		tx := db.Begin()
		if tx.Error != nil {
			return fmt.Errorf("failed to begin transaction: %w", tx.Error)
		}

		for i, stmt := range statements {
			stmtSQL := strings.TrimSpace(stmt)
			if stmtSQL == "" {
				continue
			}

			result := tx.Exec(stmtSQL)
			if result.Error != nil {
				tx.Rollback()
				return fmt.Errorf("statement %d failed: %w", i+1, result.Error)
			}
			statementCount++
		}

		if commitErr := tx.Commit().Error; commitErr != nil {
			return fmt.Errorf("failed to commit transaction: %w", commitErr)
		}
	}

	fmt.Printf("Successfully executed %d statement(s) from %s\n", statementCount, filePath)
	return nil
}

// importJSONFile imports data from a JSON file
func importJSONFile(db *gorm.DB, filePath string, autocommit bool) error {
	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read JSON file: %w", err)
	}

	// Parse JSON array
	var data []map[string]interface{}
	if err := json.Unmarshal(content, &data); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	if len(data) == 0 {
		return fmt.Errorf("JSON file is empty or not an array")
	}

	// Infer table name from file name (without extension)
	tableName := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))

	// Detect database type
	dbType := detectDBType(db)

	// Generate INSERT statements
	var insertSQL strings.Builder
	for _, row := range data {
		insertSQL.WriteString(generateInsertSQL(tableName, row, dbType))
		insertSQL.WriteString("\n")
	}

	// Execute in transaction or autocommit mode
	if !autocommit {
		tx := db.Begin()
		if tx.Error != nil {
			return fmt.Errorf("failed to begin transaction: %w", tx.Error)
		}

		result := tx.Exec(insertSQL.String())
		if result.Error != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute INSERT statements: %w", result.Error)
		}

		if commitErr := tx.Commit().Error; commitErr != nil {
			return fmt.Errorf("failed to commit transaction: %w", commitErr)
		}
	} else {
		result := db.Exec(insertSQL.String())
		if result.Error != nil {
			return fmt.Errorf("failed to execute INSERT statements: %w", result.Error)
		}
	}

	fmt.Printf("Successfully imported %d row(s) from %s\n", len(data), filePath)
	return nil
}

// detectDBType detects the database type from the connection
func detectDBType(db *gorm.DB) string {
	if db == nil {
		return "mysql"
	}
	dia := db.Dialector.Name()
	if strings.Contains(strings.ToLower(dia), "dameng") || strings.Contains(strings.ToLower(dia), "dm") {
		return "dameng"
	}
	return "mysql"
}

// generateInsertSQL generates an INSERT statement from a map
func generateInsertSQL(tableName string, row map[string]interface{}, dbType string) string {
	var columns []string
	var values []string

	for col, val := range row {
		columns = append(columns, col)
		values = append(values, formatValue(val))
	}

	// Use appropriate quote character based on database type
	quoteChar := "`"
	if dbType == "dameng" {
		quoteChar = `"`
		tableName = strings.ToUpper(tableName)
	}

	return fmt.Sprintf("INSERT INTO %s%s%s (%s) VALUES (%s);",
		quoteChar,
		tableName,
		quoteChar,
		strings.Join(columns, ", "),
		strings.Join(values, ", "))
}

// formatValue formats a value for SQL
func formatValue(val interface{}) string {
	if val == nil {
		return "NULL"
	}
	switch v := val.(type) {
	case string:
		// Check if it's an ISO 8601 timestamp and convert to SQL format
		if parsedTime, err := time.Parse(time.RFC3339, v); err == nil {
			return fmt.Sprintf("'%s'", parsedTime.Format("2006-01-02 15:04:05"))
		}
		// Escape single quotes for SQL
		return fmt.Sprintf("'%s'", strings.ReplaceAll(v, "'", "''"))
	case bool:
		if v {
			return "1"
		}
		return "0"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%v", v)
	case float32, float64:
		return fmt.Sprintf("%v", v)
	default:
		return fmt.Sprintf("'%v'", v)
	}
}
