package output

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"
)

// ToJSON converts GORM query results to a JSON array
// Each row becomes a map[string]interface{} with column names as keys
func ToJSON(rows *gorm.DB) ([]byte, error) {
	if rows == nil {
		return nil, fmt.Errorf("rows cannot be nil")
	}

	// Check for errors on the rows object
	if rows.Error != nil {
		return nil, fmt.Errorf("rows error: %w", rows.Error)
	}

	// Get the underlying sql.Rows
	sqlRows, err := rows.Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying rows: %w", err)
	}
	defer sqlRows.Close()

	result, err := ScanRows(sqlRows)
	if err != nil {
		return nil, fmt.Errorf("failed to scan rows: %w", err)
	}

	return json.Marshal(result)
}

// ScanRows scans all rows from sql.Rows into a slice of maps
// Each map represents a row with column names as keys
func ScanRows(rows *sql.Rows) ([]map[string]interface{}, error) {
	if rows == nil {
		return nil, fmt.Errorf("rows cannot be nil")
	}

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get column names: %w", err)
	}

	var result []map[string]interface{}

	// Create a slice of interface{} to hold the values
	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	// Iterate through rows
	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		rowMap := make(map[string]interface{})
		for i, colName := range columns {
			val := values[i]
			rowMap[colName] = handleNullValue(val)
		}
		result = append(result, rowMap)
	}

	// Check for iteration errors
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return result, nil
}

// handleNullValue converts sql.Null* types to their underlying values or nil
func handleNullValue(val interface{}) interface{} {
	if val == nil {
		return nil
	}

	switch v := val.(type) {
	case sql.NullBool:
		if !v.Valid {
			return nil
		}
		return v.Bool
	case sql.NullInt32:
		if !v.Valid {
			return nil
		}
		return v.Int32
	case sql.NullInt64:
		if !v.Valid {
			return nil
		}
		return v.Int64
	case sql.NullFloat64:
		if !v.Valid {
			return nil
		}
		return v.Float64
	case sql.NullString:
		if !v.Valid {
			return nil
		}
		return v.String
	case sql.NullTime:
		if !v.Valid {
			return nil
		}
		return v.Time
	case []byte:
		return string(v)
	default:
		return v
	}
}
