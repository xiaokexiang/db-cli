package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/xiaokexiang/db-cli/internal/logging"
)

var (
	logsLast   int
	logsFormat string
	logsType   string // "history", "errors", or "all"
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "View command history and error logs",
	Long: `Review command execution history and error logs for audit and debugging purposes.

Examples:
  # View all logs (history + errors)
  db-cli logs -c <dsn>

  # View only command history
  db-cli logs -c <dsn> --type=history

  # View only errors
  db-cli logs -c <dsn> --type=errors

  # View last 50 entries
  db-cli logs -c <dsn> -n 50

  # Output as JSON
  db-cli logs -c <dsn> --format=json`,
	RunE: runLogs,
}

func init() {
	rootCmd.AddCommand(logsCmd)

	logsCmd.Flags().IntVarP(&logsLast, "last", "n", 20, "Number of entries to show")
	logsCmd.Flags().StringVarP(&logsFormat, "format", "", "table", "Output format: table, json")
	logsCmd.Flags().StringVarP(&logsType, "type", "", "all", "Log type: all, history, errors")
}

func runLogs(cmd *cobra.Command, args []string) error {
	if logsType == "history" {
		return showHistory()
	} else if logsType == "errors" {
		return showErrors()
	}
	return showAllLogs()
}

func showHistory() error {
	entries, err := logging.ReadHistory(logsLast)
	if err != nil {
		return fmt.Errorf("failed to read history: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("No command history entries found.")
		return nil
	}

	switch logsFormat {
	case "json":
		return outputHistoryJSON(entries)
	case "table":
		fallthrough
	default:
		return outputHistoryTable(entries)
	}
}

func showErrors() error {
	entries, err := logging.ReadErrors(logsLast)
	if err != nil {
		return fmt.Errorf("failed to read errors: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("No error log entries found.")
		return nil
	}

	switch logsFormat {
	case "json":
		return outputErrorsJSON(entries)
	case "table":
		fallthrough
	default:
		return outputErrorsTable(entries)
	}
}

func showAllLogs() error {
	// Read both history and errors
	historyEntries, err := logging.ReadHistory(logsLast)
	if err != nil {
		return fmt.Errorf("failed to read history: %w", err)
	}

	errorEntries, err := logging.ReadErrors(logsLast)
	if err != nil {
		return fmt.Errorf("failed to read errors: %w", err)
	}

	if len(historyEntries) == 0 && len(errorEntries) == 0 {
		fmt.Println("No log entries found.")
		return nil
	}

	switch logsFormat {
	case "json":
		return outputAllLogsJSON(historyEntries, errorEntries)
	case "table":
		fallthrough
	default:
		return outputAllLogsTable(historyEntries, errorEntries)
	}
}

// History output functions (from history.go)
func outputHistoryJSON(entries []logging.LogEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}

func outputHistoryTable(entries []logging.LogEntry) error {
	var builder strings.Builder

	const (
		timestampWidth = 25
		commandWidth   = 15
		argsWidth      = 30
		exitCodeWidth  = 10
		durationWidth  = 12
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

// Error output functions (from errors.go)
func outputErrorsJSON(entries []logging.ErrorEntry) error {
	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	fmt.Println(string(data))
	return nil
}

func outputErrorsTable(entries []logging.ErrorEntry) error {
	var builder strings.Builder

	const (
		timestampWidth = 25
		commandWidth   = 15
		errorCodeWidth = 10
		messageWidth   = 50
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

// Combined output functions
func outputAllLogsJSON(history []logging.LogEntry, errors []logging.ErrorEntry) error {
	data := map[string]interface{}{
		"history": history,
		"errors":  errors,
	}
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	fmt.Println(string(jsonData))
	return nil
}

func outputAllLogsTable(history []logging.LogEntry, errors []logging.ErrorEntry) error {
	fmt.Println("=== Command History ===")
	outputHistoryTable(history)

	fmt.Println("\n=== Errors ===")
	outputErrorsTable(errors)

	return nil
}
