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
var dsnURL string // DSN URL for -c flag

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

		// Parse DSN URL if -c flag is provided
		if dsnURL != "" {
			parsedCfg, err := database.ParseDSN(dsnURL)
			if err != nil {
				return fmt.Errorf("failed to parse DSN: %w", err)
			}
			// Override cfg with parsed DSN values
			cfg = parsedCfg
		}

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
	// Only -c flag for DSN URL - all connection info in one place
	rootCmd.PersistentFlags().StringVarP(&dsnURL, "connection", "c", "", "Database connection URL (format: type://user:pass@host:port/db)")

	// Note: Required flag validation (user, database) is handled by commands that need database connections
	// Port defaults are handled in internal/database/connection.go (3306 for mysql, 5236 for dameng)
}
