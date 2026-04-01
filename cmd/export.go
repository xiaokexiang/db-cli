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
	"github.com/xiaokexiang/db-cli/internal/output"
	"gorm.io/gorm"
)

var (
	exportQuery  string
	exportTable  string
	exportOutput string
)

// detectDBTypeAndQuote detects database type and returns quote character
func detectDBTypeAndQuote(db *gorm.DB) (string, string) {
	dia := db.Dialector.Name()
	if strings.Contains(strings.ToLower(dia), "dameng") || strings.Contains(strings.ToLower(dia), "dm") {
		return "dameng", `"`
	}
	return "mysql", "`"
}

var exportCmd = &cobra.Command{
	Use:   "export [flags]",
	Short: "Export database data",
	Long: `Export query results or entire tables to a file.
Format is auto-detected from output file extension: .sql (INSERT statements) or .json

Examples:
  # Export query results as SQL (INSERT statements)
  db-cli export -c <dsn> -q "SELECT * FROM users" -o users.sql

  # Export query results as JSON
  db-cli export -c <dsn> -q "SELECT * FROM users" -o users.json

  # Export entire table with structure and data as SQL
  db-cli export -c <dsn> -t users -o users_dump.sql

  # Export entire table as JSON
  db-cli export -c <dsn> -t users -o users.json`,
	RunE: runExport,
}

func init() {
	// Add export command to root
	rootCmd.AddCommand(exportCmd)

	// Define flags
	exportCmd.Flags().StringVarP(&exportQuery, "query", "q", "", "SQL query to execute and export")
	exportCmd.Flags().StringVarP(&exportTable, "table", "t", "", "Table name to export (structure + data)")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "Output file path (required, format auto-detected from extension: .sql or .json)")

	// Mark output flag as required
	exportCmd.MarkFlagRequired("output")
}

// runExport executes the export command
func runExport(cmd *cobra.Command, args []string) error {
	// Validate: either --query or --table must be provided, not both
	if exportQuery == "" && exportTable == "" {
		return fmt.Errorf("must specify either --query or --table")
	}
	if exportQuery != "" && exportTable != "" {
		return fmt.Errorf("cannot specify both --query and --table")
	}

	// Validate output file extension
	if exportOutput == "" {
		return fmt.Errorf("--output is required")
	}
	ext := strings.ToLower(filepath.Ext(exportOutput))
	if ext != ".sql" && ext != ".json" {
		return fmt.Errorf("unsupported output format '%s': use .sql or .json extension", ext)
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

	// Route based on flags and format
	if exportQuery != "" {
		return exportQueryResults(db, exportQuery, exportOutput, ext)
	}
	if exportTable != "" {
		return exportTableData(db, exportTable, exportOutput, ext)
	}

	return fmt.Errorf("no valid operation specified")
}

// exportQueryResults exports the results of a SQL query to a file
func exportQueryResults(db *gorm.DB, query string, outputPath string, ext string) error {
	// Execute query
	result := db.Raw(query)
	if result.Error != nil {
		return fmt.Errorf("failed to execute query: %w", result.Error)
	}

	// Get rows
	rows, err := result.Rows()
	if err != nil {
		return fmt.Errorf("failed to get query results: %w", err)
	}
	defer rows.Close()

	var content string
	switch ext {
	case ".sql":
		// Generate INSERT statements
		dbType, _ := detectDBTypeAndQuote(db)
		content, err = output.ToInsertForDB(rows, "query_result", dbType)
		if err != nil {
			return fmt.Errorf("failed to generate INSERT statements: %w", err)
		}
		if content == "" {
			return fmt.Errorf("query returned no results")
		}
	case ".json":
		// Scan rows to JSON
		data, err := output.ScanRows(rows)
		if err != nil {
			return fmt.Errorf("failed to scan rows: %w", err)
		}
		jsonData, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal JSON: %w", err)
		}
		content = string(jsonData)
	}

	// Write to file
	if err := writeExportFile(outputPath, content, "Query export", ext); err != nil {
		return err
	}
	fmt.Printf("Successfully exported query results to %s\n", outputPath)

	return nil
}

// exportTableData exports an entire table's structure and/or data
func exportTableData(db *gorm.DB, tableName string, outputPath string, ext string) error {
	var content string

	switch ext {
	case ".sql":
		var builder strings.Builder
		// Generate CREATE TABLE statement followed by INSERT statements
		createSQL, err := output.GetCreateTable(db, tableName)
		if err != nil {
			return fmt.Errorf("failed to generate CREATE TABLE: %w", err)
		}
		builder.WriteString(createSQL)
		builder.WriteString("\n\n")

		// Also export data as INSERT statements
		rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s", tableName)).Rows()
		if err != nil {
			return fmt.Errorf("failed to query table data: %w", err)
		}

		dbType, _ := detectDBTypeAndQuote(db)
		insertSQL, err := output.ToInsertForDB(rows, tableName, dbType)
		rows.Close()
		if err != nil {
			return fmt.Errorf("failed to generate INSERT statements: %w", err)
		}

		if insertSQL != "" {
			builder.WriteString(insertSQL)
		}
		content = builder.String()

	case ".json":
		// Export data as JSON array
		rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s", tableName)).Rows()
		if err != nil {
			return fmt.Errorf("failed to query table data: %w", err)
		}
		defer rows.Close()

		data, err := output.ScanRows(rows)
		if err != nil {
			return fmt.Errorf("failed to scan rows: %w", err)
		}
		jsonData, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal JSON: %w", err)
		}
		content = string(jsonData)
	}

	// Write to file
	if err := writeExportFile(outputPath, content, "Table export", ext); err != nil {
		return err
	}
	fmt.Printf("Successfully exported table '%s' to %s\n", tableName, outputPath)

	return nil
}

// writeExportFile writes content to a file with a header comment (for SQL only)
func writeExportFile(path, content, header, ext string) error {
	var finalContent string

	if ext == ".sql" {
		// Add SQL header comment
		var builder strings.Builder
		builder.WriteString(fmt.Sprintf("-- %s\n", header))
		builder.WriteString(fmt.Sprintf("-- Exported by db-cli on %s\n", time.Now().Format("2006-01-02 15:04:05")))
		builder.WriteString("\n")
		builder.WriteString(content)
		finalContent = builder.String()
	} else {
		// JSON doesn't need header
		finalContent = content
	}

	// Write to file with 0644 permissions
	if err := os.WriteFile(path, []byte(finalContent), 0644); err != nil {
		return fmt.Errorf("failed to write output file: %w", err)
	}

	return nil
}
