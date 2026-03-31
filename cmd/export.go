package cmd

import (
	"fmt"
	"os"
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
	exportFormat string
)

var exportCmd = &cobra.Command{
	Use:   "export [flags]",
	Short: "Export database data",
	Long: `Export query results or entire tables to SQL files.
Supports INSERT format for data export and DDL format for table structure.

Examples:
  # Export query results to INSERT statements
  db-cli export -h localhost -u root -p password -d mydb --query="SELECT * FROM users" --output=users.sql --format=insert

  # Export entire table with structure and data
  db-cli export -h localhost -u root -p password -d mydb --table=users --output=users_dump.sql --format=ddl

  # Export only table structure (DDL)
  db-cli export -h localhost -u root -p password -d mydb --table=users --output=users_schema.sql --format=ddl`,
	RunE: runExport,
}

func init() {
	// Add export command to root
	rootCmd.AddCommand(exportCmd)

	// Define flags
	exportCmd.Flags().StringVarP(&exportQuery, "query", "q", "", "SQL query to execute and export")
	exportCmd.Flags().StringVarP(&exportTable, "table", "t", "", "Table name to export (structure + data)")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "Output file path (required)")
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "insert", "Output format: insert or ddl")
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

	// Validate --output is provided
	if exportOutput == "" {
		return fmt.Errorf("--output is required")
	}

	// Validate --format is "insert" or "ddl"
	if exportFormat != "insert" && exportFormat != "ddl" {
		return fmt.Errorf("invalid format '%s': must be 'insert' or 'ddl'", exportFormat)
	}

	// Validate required connection parameters
	if cfg.User == "" {
		return fmt.Errorf("user is required (use -u or --user)")
	}
	if cfg.Database == "" {
		return fmt.Errorf("database is required (use -d or --database)")
	}

	// Validate Dameng support (not yet supported in Phase 2)
	if cfg.DBType == "dameng" {
		return fmt.Errorf("dameng export not yet supported in Phase 2")
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

	// Route based on flags
	if exportQuery != "" {
		return exportQueryResults(db, exportQuery, exportOutput, exportFormat)
	}
	if exportTable != "" {
		return exportTableData(db, exportTable, exportOutput, exportFormat)
	}

	return fmt.Errorf("no valid operation specified")
}

// exportQueryResults exports the results of a SQL query to a file
func exportQueryResults(db *gorm.DB, query string, outputPath string, format string) error {
	// For query export, only INSERT format makes sense
	if format != "insert" {
		return fmt.Errorf("--format=ddl is not supported with --query, use --format=insert")
	}

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

	// Generate INSERT statements (use generic table name for query results)
	insertSQL, err := output.ToInsert(rows, "query_result")
	if err != nil {
		return fmt.Errorf("failed to generate INSERT statements: %w", err)
	}

	if insertSQL == "" {
		return fmt.Errorf("query returned no results")
	}

	// Write to file
	if err := writeExportFile(outputPath, insertSQL, "Query export"); err != nil {
		return err
	}

	fmt.Printf("Successfully exported query results to %s\n", outputPath)
	return nil
}

// exportTableData exports an entire table's structure and/or data
func exportTableData(db *gorm.DB, tableName string, outputPath string, format string) error {
	var content strings.Builder

	// Add header comment
	header := fmt.Sprintf("Table export: %s", tableName)

	switch format {
	case "ddl":
		// Generate CREATE TABLE statement
		createSQL, err := output.GetCreateTable(db, tableName)
		if err != nil {
			return fmt.Errorf("failed to generate CREATE TABLE: %w", err)
		}
		content.WriteString(createSQL)
		content.WriteString("\n\n")

		// Also export data as INSERT statements
		rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s", tableName)).Rows()
		if err != nil {
			return fmt.Errorf("failed to query table data: %w", err)
		}

		insertSQL, err := output.ToInsert(rows, tableName)
		rows.Close()
		if err != nil {
			return fmt.Errorf("failed to generate INSERT statements: %w", err)
		}

		if insertSQL != "" {
			content.WriteString(insertSQL)
		}

	case "insert":
		// Export only data as INSERT statements
		rows, err := db.Raw(fmt.Sprintf("SELECT * FROM %s", tableName)).Rows()
		if err != nil {
			return fmt.Errorf("failed to query table data: %w", err)
		}
		defer rows.Close()

		insertSQL, err := output.ToInsert(rows, tableName)
		if err != nil {
			return fmt.Errorf("failed to generate INSERT statements: %w", err)
		}

		if insertSQL == "" {
			return fmt.Errorf("table is empty")
		}

		content.WriteString(insertSQL)
	}

	// Write to file
	if err := writeExportFile(outputPath, content.String(), header); err != nil {
		return err
	}

	fmt.Printf("Successfully exported table '%s' to %s\n", tableName, outputPath)
	return nil
}

// writeExportFile writes content to a file with a header comment
func writeExportFile(path, content, header string) error {
	// Build file content with header
	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("-- %s\n", header))
	builder.WriteString(fmt.Sprintf("-- Exported by db-cli on %s\n", time.Now().Format("2006-01-02 15:04:05")))
	builder.WriteString("\n")
	builder.WriteString(content)

	// Write to file with 0644 permissions
	if err := os.WriteFile(path, []byte(builder.String()), 0644); err != nil {
		return fmt.Errorf("failed to write output file: %w", err)
	}

	return nil
}
