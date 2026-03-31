package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/database"
)

var importFile string

var importCmd = &cobra.Command{
	Use:   "import [flags]",
	Short: "Import SQL file (alias for exec --file)",
	Long: `Import and execute statements from a SQL file.
This is a semantic alias for 'exec --file=xxx.sql'.

Examples:
  # Import a SQL file
  db-cli import -h localhost -u root -p password -d mydb --file=script.sql

  # Import with transaction mode (all or nothing)
  db-cli import -h localhost -u root -p password -d mydb --file=script.sql --autocommit=false

  # Change output format
  db-cli import -h localhost -u root -p password -d mydb --file=script.sql --format=table`,
	RunE: runImport,
}

func init() {
	// Add import command to root
	rootCmd.AddCommand(importCmd)

	// Define flags (same as exec command)
	importCmd.Flags().StringVarP(&importFile, "file", "f", "", "SQL file to import (required)")
	importCmd.Flags().StringVarP(&execFormat, "format", "", "json", "Output format: json, table, csv")
	importCmd.Flags().BoolVarP(&execAutocommit, "autocommit", "", true, "Auto-commit each SQL statement")

	// Mark file flag as required
	if err := importCmd.MarkFlagRequired("file"); err != nil {
		panic(fmt.Sprintf("failed to mark file flag as required: %v", err))
	}
}

// runImport is the main import logic - delegates to exec's execution logic
func runImport(cmd *cobra.Command, args []string) error {
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

	// Delegate to the same execution logic as exec --file
	return executeSQLFile(db, importFile, execFormat, execAutocommit)
}
