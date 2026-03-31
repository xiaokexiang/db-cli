package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
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

	// TODO: Implement SQL execution logic
	return fmt.Errorf("exec command not yet implemented")
}
