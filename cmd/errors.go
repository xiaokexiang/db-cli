package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/logging"
)

var (
	errorsLast  int
	errorsFormat string
)

var errorsCmd = &cobra.Command{
	Use:   "errors",
	Short: "View error log",
	Long:  `Review error log for debugging purposes.`,
	RunE:  runErrors,
}

func init() {
	rootCmd.AddCommand(errorsCmd)

	errorsCmd.Flags().IntVarP(&errorsLast, "last", "n", 20, "Number of entries to show")
	errorsCmd.Flags().StringVarP(&errorsFormat, "format", "", "table", "Output format: table, json")
}

func runErrors(cmd *cobra.Command, args []string) error {
	entries, err := logging.ReadErrors(errorsLast)
	if err != nil {
		return fmt.Errorf("failed to read errors: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("No error log entries found.")
		return nil
	}

	switch errorsFormat {
	case "json":
		return outputErrorsJSON(entries)
	case "table":
		fallthrough
	default:
		return outputErrorsTable(entries)
	}
}

func outputErrorsJSON(entries []logging.ErrorEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}

func outputErrorsTable(entries []logging.ErrorEntry) error {
	// Build table header
	var builder strings.Builder

	// Column widths
	const (
		timestampWidth = 25
		commandWidth = 15
		errorCodeWidth = 10
		messageWidth = 50
	)

	// Header
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", errorCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", messageWidth+2))
	builder.WriteString("+\n")

	builder.WriteString("| ")
	builder.WriteString(fmt.Sprintf("%-*s", timestampWidth, "Timestamp"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", commandWidth, "Command"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", errorCodeWidth, "Error Code"))
	builder.WriteString(" | ")
	builder.WriteString(fmt.Sprintf("%-*s", messageWidth, "Message"))
	builder.WriteString(" |\n")

	// Separator
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", errorCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", messageWidth+2))
	builder.WriteString("+\n")

	// Data rows
	for _, entry := range entries {
		message := entry.Message
		if len(message) > messageWidth {
			message = message[:messageWidth-3] + "..."
		}

		builder.WriteString("| ")
		builder.WriteString(fmt.Sprintf("%-*s", timestampWidth, entry.Timestamp))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*s", commandWidth, entry.Command))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*d", errorCodeWidth, entry.ErrorCode))
		builder.WriteString(" | ")
		builder.WriteString(fmt.Sprintf("%-*s", messageWidth, message))
		builder.WriteString(" |\n")
	}

	// Footer
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", timestampWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", commandWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", errorCodeWidth+2))
	builder.WriteString("+")
	builder.WriteString(strings.Repeat("-", messageWidth+2))
	builder.WriteString("+\n")

	fmt.Println(builder.String())
	return nil
}
