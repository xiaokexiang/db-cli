package database

import (
	"database/sql"
	"fmt"
	"strings"

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

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return getTableColumnsDameng(db, tableName)
	}
	return getTableColumnsMySQL(db, tableName)
}

// getTableColumnsMySQL retrieves column information for MySQL
func getTableColumnsMySQL(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	// Get current database name
	currentDB := db.Migrator().CurrentDatabase()

	// Query INFORMATION_SCHEMA for column information
	// Note: Use double quotes for aliases that are reserved words
	query := fmt.Sprintf(`
		SELECT
			COLUMN_NAME as Field,
			COLUMN_TYPE as Type,
			IS_NULLABLE as "Null",
			COLUMN_KEY as "Key",
			COLUMN_DEFAULT as "Default",
			EXTRA as Extra
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = '%s' AND TABLE_NAME = '%s'
		ORDER BY ORDINAL_POSITION
	`, currentDB, tableName)

	rows, err := db.Raw(query).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to query table columns: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// getTableColumnsDameng retrieves column information for Dameng
func getTableColumnsDameng(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	// Get current schema name (user/schema in Dameng)
	currentSchema := db.Migrator().CurrentDatabase()

	// Query USER_TAB_COLUMNS and USER_COL_COMMENTS for Dameng
	// Dameng uses different system views
	// Dameng requires double quotes for case-sensitive aliases
	// Build complete type definitions with lengths
	query := fmt.Sprintf(`
		SELECT
			t.COLUMN_NAME as "Field",
			CASE
				WHEN t.DATA_TYPE = 'VARCHAR' OR t.DATA_TYPE = 'VARCHAR2' THEN
					CASE WHEN t.DATA_LENGTH > 4000 THEN 'CLOB'
					ELSE 'VARCHAR(' || t.DATA_LENGTH || ')'
					END
				WHEN t.DATA_TYPE = 'NUMBER' THEN
					CASE WHEN t.DATA_SCALE = 0 THEN 'NUMBER'
					WHEN t.DATA_PRECISION = 0 THEN 'NUMBER'
					ELSE 'NUMBER(' || t.DATA_PRECISION || ',' || t.DATA_SCALE || ')'
					END
				WHEN t.DATA_TYPE = 'INT' THEN 'INT'
				ELSE t.DATA_TYPE
			END as "Type",
			CASE WHEN t.NULLABLE = 'Y' THEN 'YES' ELSE 'NO' END as "Null",
			'' as "Key",
			t.DATA_DEFAULT as "Default",
			'' as Extra
		FROM USER_TAB_COLUMNS t
		WHERE t.TABLE_NAME = UPPER('%s')
		ORDER BY t.COLUMN_ID
	`, tableName)

	rows, err := db.Raw(query).Rows()
	if err != nil {
		// Try alternative query if schema is different
		// Dameng requires double quotes for case-sensitive aliases
		query = fmt.Sprintf(`
			SELECT
				COLUMN_NAME as "Field",
				DATA_TYPE as "Type",
				CASE WHEN NULLABLE = 'Y' THEN 'YES' ELSE 'NO' END as "Null",
				'' as "Key",
				DATA_DEFAULT as "Default",
				'' as Extra
			FROM ALL_TAB_COLUMNS
			WHERE OWNER = '%s' AND TABLE_NAME = UPPER('%s')
			ORDER BY COLUMN_ID
		`, currentSchema, tableName)
		rows, err = db.Raw(query).Rows()
		if err != nil {
			return nil, fmt.Errorf("failed to query table columns: %w", err)
		}
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

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return getIndexesDameng(db, tableName)
	}
	return getIndexesMySQL(db, tableName)
}

// getIndexesMySQL retrieves index information for MySQL
func getIndexesMySQL(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	// Use SHOW INDEX for MySQL
	query := fmt.Sprintf("SHOW INDEX FROM %s", tableName)

	rows, err := db.Raw(query).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to query indexes: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// getIndexesDameng retrieves index information for Dameng
func getIndexesDameng(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	// Query user_indexes and user_ind_columns for Dameng
	query := fmt.Sprintf(`
		SELECT
			i.INDEX_NAME as Key_name,
			i.TABLE_NAME as Table_name,
			i.UNIQUENESS as Uniqueness,
			c.COLUMN_NAME as Column_name,
			c.COLUMN_POSITION as Seq_in_index
		FROM USER_INDEXES i
		JOIN USER_IND_COLUMNS c ON i.INDEX_NAME = c.INDEX_NAME
		WHERE i.TABLE_NAME = UPPER('%s')
		ORDER BY i.INDEX_NAME, c.COLUMN_POSITION
	`, tableName)

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

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return getForeignKeysDameng(db, tableName)
	}
	return getForeignKeysMySQL(db, tableName)
}

// getForeignKeysMySQL retrieves foreign key information for MySQL
func getForeignKeysMySQL(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
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

// getForeignKeysDameng retrieves foreign key information for Dameng
func getForeignKeysDameng(db *gorm.DB, tableName string) ([]map[string]interface{}, error) {
	// Query user_constraints and user_cons_columns for Dameng
	query := fmt.Sprintf(`
		SELECT
			cc.COLUMN_NAME as Column_Name,
			c.CONSTRAINT_NAME as Constraint_Name,
			cc.POSITION as Position,
			rcc.TABLE_NAME as Referenced_Table,
			rcc.COLUMN_NAME as Referenced_Column
		FROM USER_CONSTRAINTS c
		JOIN USER_CONS_COLUMNS cc ON c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
		JOIN USER_CONSTRAINTS r ON c.R_CONSTRAINT_NAME = r.CONSTRAINT_NAME
		JOIN USER_CONS_COLUMNS rcc ON r.CONSTRAINT_NAME = rcc.CONSTRAINT_NAME
		WHERE c.CONSTRAINT_TYPE = 'R'
		AND c.TABLE_NAME = UPPER('%s')
		ORDER BY c.CONSTRAINT_NAME, cc.POSITION
	`, tableName)

	rows, err := db.Raw(query).Rows()
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

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return listDatabasesDameng(db)
	}
	return listDatabasesMySQL(db)
}

// listDatabasesMySQL lists all databases for MySQL
func listDatabasesMySQL(db *gorm.DB) ([]map[string]interface{}, error) {
	// Use SHOW DATABASES
	rows, err := db.Raw("SHOW DATABASES").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// listDatabasesDameng lists all schemas for Dameng
func listDatabasesDameng(db *gorm.DB) ([]map[string]interface{}, error) {
	// In Dameng, schemas are users, query ALL_USERS
	// Dameng uses double quotes for aliases, not single quotes
	rows, err := db.Raw("SELECT USERNAME AS \"USERNAME\" FROM ALL_USERS ORDER BY USERNAME").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list schemas: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// ListTables lists all tables in the current database
func ListTables(db *gorm.DB) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return listTablesDameng(db)
	}
	return listTablesMySQL(db)
}

// listTablesMySQL lists all tables for MySQL
func listTablesMySQL(db *gorm.DB) ([]map[string]interface{}, error) {
	// Use SHOW TABLES
	rows, err := db.Raw("SHOW TABLES").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// listTablesDameng lists all tables for Dameng
func listTablesDameng(db *gorm.DB) ([]map[string]interface{}, error) {
	// Query USER_TABLES for Dameng
	// Dameng uses double quotes for aliases, not single quotes
	rows, err := db.Raw("SELECT TABLE_NAME AS \"TABLE_NAME\" FROM USER_TABLES ORDER BY TABLE_NAME").Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	return scanRowsToMap(rows)
}

// detectDBType detects the database type from the connection
func detectDBType(db *gorm.DB) string {
	// Try to get the current database name
	dbName := db.Migrator().CurrentDatabase()

	// Check if it's a Dameng-specific database
	if strings.Contains(strings.ToUpper(dbName), "DAMENG") ||
	   strings.Contains(strings.ToUpper(dbName), "SYSDBA") {
		return "dameng"
	}

	// Check dialect
	dia := db.Dialector.Name()
	if strings.Contains(strings.ToLower(dia), "dameng") ||
	   strings.Contains(strings.ToLower(dia), "dm") {
		return "dameng"
	}

	// Default to MySQL
	return "mysql"
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
