package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/logging"
)

var (
	historyLast  int
	historyFormat string
)

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "View command history",
	Long:  `Review command execution history for audit purposes.`,
	RunE:  runHistory,
}

func init() {
	rootCmd.AddCommand(historyCmd)

	historyCmd.Flags().IntVarP(&historyLast, "last", "n", 20, "Number of entries to show")
	historyCmd.Flags().StringVarP(&historyFormat, "format", "", "table", "Output format: table, json")
}

func runHistory(cmd *cobra.Command, args []string) error {
	entries, err := logging.ReadHistory(historyLast)
	if err != nil {
		return fmt.Errorf("failed to read history: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("No command history found.")
		return nil
	}

	switch historyFormat {
	case "json":
		return outputHistoryJSON(entries)
	case "table":
		fallthrough
	default:
		return outputHistoryTable(entries)
	}
}

func outputHistoryJSON(entries []logging.LogEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}

func outputHistoryTable(entries []logging.LogEntry) error {
	// Build table header
	var builder strings.Builder

	// Column widths
	const (
		timestampWidth = 25
		commandWidth = 15
		argsWidth = 30
		exitCodeWidth = 10
		durationWidth = 12
	)

	// Header
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", argsWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", exitCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", durationWidth+2))
	builder.WriteString("+\n")

	builder.WriteString("| ")
	builder.WriteString(fmt.Sprintf("%-*s", timestampWidth, "Timestamp"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", commandWidth, "Command"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", argsWidth, "Args"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", exitCodeWidth, "Exit Code"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", durationWidth, "Duration"))
	builder.WriteString(" |\n")

	// Separator
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", argsWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", exitCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", durationWidth+2))
	builder.WriteString("+\n")

	// Data rows
	for _, entry := range entries {
		argsStr := strings.Join(entry.Args, " ")
		if len(argsStr) > argsWidth {
			argsStr = argsStr[:argsWidth-3] + "..."
		}

		builder.WriteString("| ")
		builder.WriteString(fmt.Sprintf("%-*s", timestampWidth, entry.Timestamp))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*s", commandWidth, entry.Command))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*s", argsWidth, argsStr))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*d", exitCodeWidth, entry.ExitCode))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*d", durationWidth, entry.DurationMs))
		builder.WriteString(" ms |\n")
	}

	// Footer
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", argsWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", exitCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", durationWidth+2))
	builder.WriteString("+\n")

	fmt.Println(builder.String())
	return nil
}
