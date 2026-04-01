package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/database"
	"gorm.io/gorm"
)

var (
	descTable        string
	descIndexes      bool
	descForeignKeys  bool
	descDatabases    bool
	descTables       bool
)

var descCmd = &cobra.Command{
	Use:   "desc [flags]",
	Short: "Describe database schema",
	Long: `Inspect database schema without writing raw SQL queries.
View table structure, indexes, foreign keys, and metadata.

Examples:
  # View table structure
  db-cli desc -h localhost -u root -p password -d mydb --table=users

  # View indexes for a table
  db-cli desc -h localhost -u root -p password -d mydb --table=users --indexes

  # View foreign keys
  db-cli desc -h localhost -u root -p password -d mydb --table=orders --foreign-keys

  # List all databases
  db-cli desc -h localhost -u root -p password -d mydb --databases

  # List all tables in current database
  db-cli desc -h localhost -u root -p password -d mydb --tables`,
	RunE: runDesc,
}

func init() {
	// Add desc command to root
	rootCmd.AddCommand(descCmd)

	// Define flags
	descCmd.Flags().StringVarP(&descTable, "table", "t", "", "Table name to describe")
	descCmd.Flags().BoolVarP(&descIndexes, "indexes", "i", false, "Show indexes for the table")
	descCmd.Flags().BoolVarP(&descForeignKeys, "foreign-keys", "k", false, "Show foreign keys for the table")
	descCmd.Flags().BoolVarP(&descDatabases, "databases", "D", false, "List all databases")
	descCmd.Flags().BoolVarP(&descTables, "tables", "B", false, "List all tables in current database")
}

// runDesc executes the desc command
func runDesc(cmd *cobra.Command, args []string) error {
	// Validate: at least one flag must be provided
	if !descDatabases && !descTables && descTable == "" && !descIndexes && !descForeignKeys {
		return fmt.Errorf("must specify one of: --table, --indexes, --foreign-keys, --databases, --tables")
	}

	// Validate required connection parameters
	if cfg.User == "" {
		return fmt.Errorf("user is required")
	}
	// For Dameng, database is optional (defaults to username as schema)
	// For MySQL desc --databases, database is also optional
	if cfg.Database == "" && !descDatabases && cfg.DBType != "dameng" {
		return fmt.Errorf("database is required")
	}

	// Validate flag combinations
	if descDatabases && descTables {
		return fmt.Errorf("cannot specify both --databases and --tables")
	}
	if descDatabases && descTable != "" {
		return fmt.Errorf("cannot specify both --databases and --table")
	}
	if descDatabases && descIndexes {
		return fmt.Errorf("--databases cannot be combined with --indexes")
	}
	if descDatabases && descForeignKeys {
		return fmt.Errorf("--databases cannot be combined with --foreign-keys")
	}
	if descTables && descIndexes {
		return fmt.Errorf("--tables cannot be combined with --indexes")
	}
	if descTables && descForeignKeys {
		return fmt.Errorf("--tables cannot be combined with --foreign-keys")
	}
	if descIndexes && descForeignKeys {
		return fmt.Errorf("cannot specify both --indexes and --foreign-keys")
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

	// Route based on flags
	if descDatabases {
		return listDatabases(db)
	}
	if descTables {
		return listTables(db)
	}
	if descTable != "" {
		if descIndexes {
			return showIndexes(db, descTable)
		}
		if descForeignKeys {
			return showForeignKeys(db, descTable)
		}
		return describeTable(db, descTable)
	}

	return fmt.Errorf("no valid operation specified")
}

// describeTable shows the structure of a table
func describeTable(db *gorm.DB, tableName string) error {
	columns, err := database.GetTableColumns(db, tableName)
	if err != nil {
		return fmt.Errorf("failed to get table columns: %w", err)
	}

	// Output as JSON
	jsonData, err := json.MarshalIndent(columns, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}

// showIndexes shows indexes for a table
func showIndexes(db *gorm.DB, tableName string) error {
	indexes, err := database.GetIndexes(db, tableName)
	if err != nil {
		return fmt.Errorf("failed to get indexes: %w", err)
	}

	// Output as JSON
	jsonData, err := json.MarshalIndent(indexes, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}

// showForeignKeys shows foreign keys for a table
func showForeignKeys(db *gorm.DB, tableName string) error {
	foreignKeys, err := database.GetForeignKeys(db, tableName)
	if err != nil {
		return fmt.Errorf("failed to get foreign keys: %w", err)
	}

	// Output as JSON
	jsonData, err := json.MarshalIndent(foreignKeys, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}

// listDatabases lists all databases
func listDatabases(db *gorm.DB) error {
	databases, err := database.ListDatabases(db)
	if err != nil {
		return fmt.Errorf("failed to list databases: %w", err)
	}

	// Output as JSON
	jsonData, err := json.MarshalIndent(databases, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}

// listTables lists all tables in the current database
func listTables(db *gorm.DB) error {
	tables, err := database.ListTables(db)
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	// Output as JSON
	jsonData, err := json.MarshalIndent(tables, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	fmt.Println(string(jsonData))
	return nil
}
