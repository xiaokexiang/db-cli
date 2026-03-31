package output

import (
	"database/sql"
	"fmt"
	"strings"
)

// ToTable converts query results to an ASCII table format
// Each row is displayed with aligned columns and separators
func ToTable(rows *sql.Rows) (string, error) {
	if rows == nil {
		return "", fmt.Errorf("rows cannot be nil")
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return "", fmt.Errorf("failed to get column names: %w", err)
	}

	// Scan all rows into memory to calculate column widths
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	var allRows [][]string
	maxWidths := make([]int, len(columns))

	// Initialize max widths with column header lengths
	for i := range columns {
		maxWidths[i] = len(columns[i])
	}

	// Iterate through rows
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return "", fmt.Errorf("failed to scan row: %w", err)
		}

		rowData := make([]string, len(columns))
		for i := range columns {
			val := handleNullValue(values[i])
			if val == nil {
				rowData[i] = "NULL"
			} else {
				rowData[i] = fmt.Sprintf("%v", val)
			}
			// Update max width for this column
			if len(rowData[i]) > maxWidths[i] {
				maxWidths[i] = len(rowData[i])
			}
		}
		allRows = append(allRows, rowData)
	}

	// Check for iteration errors
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("row iteration error: %w", err)
	}

	// Build the ASCII table
	var builder strings.Builder

	// Calculate total width
	totalWidth := len(columns) + 1 // separators
	for _, w := range maxWidths {
		totalWidth += w
	}

	// Build header separator line
	separator := "+"
	for _, w := range maxWidths {
		separator += strings.Repeat("-", w+2) + "+"
	}

	// Build header row
	builder.WriteString(separator)
	builder.WriteString("\n|")
	for i, col := range columns {
		builder.WriteString(fmt.Sprintf(" %-*s |", maxWidths[i], col))
	}
	builder.WriteString("\n")
	builder.WriteString(separator)

	// Build data rows
	for _, rowData := range allRows {
		builder.WriteString("\n|")
		for i, val := range rowData {
			builder.WriteString(fmt.Sprintf(" %-*s |", maxWidths[i], val))
		}
	}

	if len(allRows) > 0 {
		builder.WriteString("\n")
		builder.WriteString(separator)
	}

	return builder.String(), nil
}
