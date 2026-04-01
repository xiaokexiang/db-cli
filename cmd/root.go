package cmd

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/database"
	"github.com/xiaokexiang/db-cli/internal/logging"
)

var cfg database.ConnectionConfig

// commandStart stores the start time of the current command
var commandStart time.Time

var rootCmd = &cobra.Command{
	Use:   "db-cli",
	Short: "Database CLI tool for MySQL and Dameng",
	Long: `A cross-platform database CLI tool using GORM for MySQL and Dameng databases.
Execute SQL statements, import/export data, and inspect database schemas.`,
	// Disable default help command and flag to use -h for host
	SilenceUsage: true,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Record command start time
		commandStart = time.Now()

		// Handle password=- (read from stdin)
		if cfg.Password == "-" {
			reader := bufio.NewReader(os.Stdin)
			password, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					return fmt.Errorf("failed to read password from stdin: %w", err)
				}
				// EOF is ok if we got some password
			}
			cfg.Password = strings.TrimRight(password, "\n\r")
		}
		return nil
	},
	PersistentPostRunE: func(cmd *cobra.Command, args []string) error {
		// Log command completion (success - exit code 0)
		duration := time.Since(commandStart)
		logging.GetLogger().LogCommand(cmd.Name(), os.Args[1:], 0, duration)
		return nil
	},
}

// Execute runs the root command
func Execute() {
	rootCmd.CompletionOptions.DisableDefaultCmd = true
	if err := rootCmd.Execute(); err != nil {
		// Log error
		duration := time.Since(commandStart)
		logger := logging.GetLogger()
		logger.LogError(rootCmd.Name(), os.Args[1:], 1, err.Error())
		logger.LogCommand(rootCmd.Name(), os.Args[1:], 1, duration)
		os.Exit(1)
	}
}

func init() {
	// Disable the default help flag to use -h for host
	rootCmd.SetHelpCommand(&cobra.Command{
		Hidden: true,
	})
	rootCmd.PersistentFlags().BoolP("help", "?", false, "Show help")

	// Define persistent flags for connection parameters
	rootCmd.PersistentFlags().StringVarP(&cfg.Host, "host", "h", "localhost", "Database host")
	rootCmd.PersistentFlags().IntVarP(&cfg.Port, "port", "P", 0, "Database port (default: 3306 for mysql, 5236 for dameng)")
	rootCmd.PersistentFlags().StringVarP(&cfg.User, "user", "u", "", "Database user (required)")
	rootCmd.PersistentFlags().StringVarP(&cfg.Password, "password", "p", "", "Database password (use '-' to read from stdin)")
	rootCmd.PersistentFlags().StringVarP(&cfg.Database, "database", "d", "", "Database name (required)")
	rootCmd.PersistentFlags().StringVarP(&cfg.DBType, "type", "t", "mysql", "Database type (mysql, dameng)")

	// Note: Required flag validation (user, database) is handled by commands that need database connections
	// Port defaults are handled in internal/database/connection.go (3306 for mysql, 5236 for dameng)
}
