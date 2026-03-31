package output

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"strings"
)

// ToCSV converts query results to CSV format
// Uses the standard encoding/csv package for proper escaping
func ToCSV(rows *sql.Rows, delimiter rune) (string, error) {
	if rows == nil {
		return "", fmt.Errorf("rows cannot be nil")
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return "", fmt.Errorf("failed to get column names: %w", err)
	}

	// Create a string builder to capture CSV output
	var sb strings.Builder

	// Create CSV writer
	writer := csv.NewWriter(&sb)
	writer.Comma = delimiter

	// Write header row
	if err := writer.Write(columns); err != nil {
		return "", fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Prepare scan buffers
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	// Iterate through rows
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return "", fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert row to string slice
		record := make([]string, len(columns))
		for i := range columns {
			val := handleNullValue(values[i])
			if val == nil {
				record[i] = "" // Empty string for NULL values in CSV
			} else {
				record[i] = fmt.Sprintf("%v", val)
			}
		}

		// Write row to CSV
		if err := writer.Write(record); err != nil {
			return "", fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	// Check for iteration errors
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("row iteration error: %w", err)
	}

	// Flush the CSV writer
	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return sb.String(), nil
}

// ToCSVWithDelimiter converts query results to CSV format with custom delimiter
// Common delimiters: ',' (comma), '\t' (tab), ';' (semicolon), '|' (pipe)
func ToCSVWithDelimiter(rows *sql.Rows, delimiter string) (string, error) {
	if rows == nil {
		return "", fmt.Errorf("rows cannot be nil")
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return "", fmt.Errorf("failed to get column names: %w", err)
	}

	// Create a string builder to capture CSV output
	var sb strings.Builder

	// Create CSV writer
	writer := csv.NewWriter(&sb)

	// Set custom delimiter
	if len(delimiter) > 0 {
		writer.Comma = []rune(delimiter)[0]
	} else {
		writer.Comma = ','
	}

	// Write header row
	if err := writer.Write(columns); err != nil {
		return "", fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Prepare scan buffers
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	// Iterate through rows
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return "", fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert row to string slice
		record := make([]string, len(columns))
		for i := range columns {
			val := handleNullValue(values[i])
			if val == nil {
				record[i] = "" // Empty string for NULL values in CSV
			} else {
				record[i] = fmt.Sprintf("%v", val)
			}
		}

		// Write row to CSV
		if err := writer.Write(record); err != nil {
			return "", fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	// Check for iteration errors
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("row iteration error: %w", err)
	}

	// Flush the CSV writer
	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", fmt.Errorf("failed to flush CSV writer: %w", err)
	}

	return sb.String(), nil
}

