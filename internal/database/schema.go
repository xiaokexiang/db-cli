package database

import (
	"database/sql"
	"fmt"

	"gorm.io/gorm"
)

// GetTableColumns retrieves column information for a table
// Returns columns in DESCRIBE format: Field, Type, Null, Key, Default, Extra
func GetTableColumns(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}
	if tableName == "" {
		return nil, fmt.Errorf("table name is required")
	}

	// Get current database name
	currentDB := db.Migrator().CurrentDatabase()

	// Query INFORMATION_SCHEMA for column information
	query := `
		SELECT
			COLUMN_NAME as Field,
			COLUMN_TYPE as Type,
			IS_NULLABLE as Null,
			COLUMN_KEY as Key,
			COLUMN_DEFAULT as Default,
			EXTRA as Extra
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION
	`

	rows, err := db.Raw(query, currentDB, tableName).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to query table columns: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// GetIndexes retrieves index information for a table
func GetIndexes(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}
	if tableName == "" {
		return nil, fmt.Errorf("table name is required")
	}

	// Use SHOW INDEX for MySQL
	query := fmt.Sprintf("SHOW INDEX FROM %s", tableName)

	rows, err := db.Raw(query).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to query indexes: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// GetForeignKeys retrieves foreign key information for a table
func GetForeignKeys(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}
	if tableName == "" {
		return nil, fmt.Errorf("table name is required")
	}

	// Get current database name
	currentDB := db.Migrator().CurrentDatabase()

	// Query INFORMATION_SCHEMA.KEY_COLUMN_USAGE for foreign keys
	query := `
		SELECT
			COLUMN_NAME as Column_Name,
			CONSTRAINT_NAME as Constraint_Name,
			REFERENCED_TABLE_NAME as Referenced_Table,
			REFERENCED_COLUMN_NAME as Referenced_Column
		FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
	`

	rows, err := db.Raw(query, currentDB, tableName).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to query foreign keys: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// ListDatabases lists all databases accessible to the current user
func ListDatabases(db *gorm.DB) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}

	// Use SHOW DATABASES
	rows, err := db.Raw("SHOW DATABASES").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// ListTables lists all tables in the current database
func ListTables(db *gorm.DB) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}

	// Use SHOW TABLES
	rows, err := db.Raw("SHOW TABLES").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// scanRowsToMap scans sql.Rows into a slice of maps
// This is a helper function reused from output package logic
func scanRowsToMap(rows *sql.Rows) ([]map[string]interface{}, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get column names: %w", err)
	}

	values := make([]interface{}, len(columns))
	scanArgs := make([]interface{}, len(columns))
	for i := range values {
		scanArgs[i] = &values[i]
	}

	var result []map[string]interface{}

	for rows.Next() {
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		rowMap := make(map[string]interface{})
		for i, colName := range columns {
			val := values[i]
			rowMap[colName] = handleDatabaseNullValue(val)
		}
		result = append(result, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return result, nil
}

// handleDatabaseNullValue converts sql.Null* types to their underlying values or nil
func handleDatabaseNullValue(val interface{}) interface{} {
	if val == nil {
		return nil
	}

	// Handle common sql.Null* types
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
