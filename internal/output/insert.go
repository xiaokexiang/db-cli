package output

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// ToInsert converts query results to INSERT statements
// Each row becomes an INSERT INTO table (cols) VALUES (vals) statement
func ToInsert(rows *sql.Rows, tableName string) (string, error) {
	return ToInsertForDB(rows, tableName, "mysql")
}

// ToInsertForDB converts query results to INSERT statements for a specific database type
func ToInsertForDB(rows *sql.Rows, tableName string, dbType string) (string, error) {
	if rows == nil {
		return "", fmt.Errorf("rows cannot be nil")
	}
	if tableName == "" {
		return "", fmt.Errorf("table name is required")
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return "", fmt.Errorf("failed to get column names: %w", err)
	}

	// Prepare scan buffers
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	var builder strings.Builder
	var allRows [][]string

	// Collect all row data
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return "", fmt.Errorf("failed to scan row: %w", err)
		}

		rowData := make([]string, len(columns))
		for i := range columns {
			val := handleNullValue(values[i])
			rowData[i] = formatSQLValue(val)
		}
		allRows = append(allRows, rowData)
	}

	// Check for iteration errors
	if err := rows.Err(); err != nil {
		return "", fmt.Errorf("row iteration error: %w", err)
	}

	// Handle empty result set
	if len(allRows) == 0 {
		return "", nil
	}

	// Quote identifiers based on database type
	// MySQL uses backticks (`), Dameng uses double quotes (")
	quoteChar := "`"
	if dbType == "dameng" {
		quoteChar = `"`
		tableName = strings.ToUpper(tableName)
	}

	// Build column list
	builder.WriteString(fmt.Sprintf("INSERT INTO %s%s%s (", quoteChar, tableName, quoteChar))
	for i, col := range columns {
		if i > 0 {
			builder.WriteString(", ")
		}
		// Quote column names to handle expressions like SELECT 1
		builder.WriteString(quoteChar)
		if dbType == "dameng" {
			builder.WriteString(strings.ToUpper(col))
		} else {
			builder.WriteString(col)
		}
		builder.WriteString(quoteChar)
	}
	builder.WriteString(") VALUES\n")

	// Build value rows
	for i, rowData := range allRows {
		if i > 0 {
			builder.WriteString(",\n")
		}
		builder.WriteString("(")
		for j, val := range rowData {
			if j > 0 {
				builder.WriteString(", ")
			}
			builder.WriteString(val)
		}
		builder.WriteString(")")
	}
	builder.WriteString(";\n")

	return builder.String(), nil
}

// formatSQLValue formats a Go value for SQL INSERT statement
func formatSQLValue(val interface{}) string {
	if val == nil {
		return "NULL"
	}

	switch v := val.(type) {
	case bool:
		if v {
			return "TRUE"
		}
		return "FALSE"
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", v)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", v)
	case float32, float64:
		return fmt.Sprintf("%v", v)
	case string:
		// Escape single quotes and backslashes for SQL
		escaped := strings.ReplaceAll(v, "'", "''")
		escaped = strings.ReplaceAll(escaped, "\\", "\\\\")
		return fmt.Sprintf("'%s'", escaped)
	case []byte:
		// Escape binary data for SQL
		escaped := strings.ReplaceAll(string(v), "'", "''")
		escaped = strings.ReplaceAll(escaped, "\\", "\\\\")
		return fmt.Sprintf("'%s'", escaped)
	case time.Time:
		// Format time.Time as SQL timestamp
		return fmt.Sprintf("'%s'", v.Format("2006-01-02 15:04:05"))
	default:
		// For other types (like time.Time), use string representation
		s := fmt.Sprintf("%v", v)
		escaped := strings.ReplaceAll(s, "'", "''")
		escaped = strings.ReplaceAll(escaped, "\\", "\\\\")
		return fmt.Sprintf("'%s'", escaped)
	}
}
