package cmd

import (
	"github.com/spf13/cobra"
	"gorm.io/gorm"
	_ "github.com/go-sql-driver/mysql"
)

var rootCmd = &cobra.Command{
	Use:   "db-cli",
	Short: "Database CLI tool",
	Long:  `A cross-platform database CLI tool using GORM for MySQL and Dameng databases.`,
}

func Execute() error {
	return rootCmd.Execute()
}

// InitializeDB creates a GORM database connection
func InitializeDB(dsn string) (*gorm.DB, error) {
	return gorm.Open(nil, nil)
}

func init() {
	// Root command initialization
}
