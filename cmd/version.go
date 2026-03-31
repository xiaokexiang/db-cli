package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var (
	// Version information - can be overridden at build time via ldflags
	Version = "1.0.0"
	Commit  = "dev"
	Date    = "unknown"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Long:  `Display the version information of db-cli including version number, commit hash, and build date.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("db-cli version %s (%s) built on %s\n", Version, Commit, Date)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
