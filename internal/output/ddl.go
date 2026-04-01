package output

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
	"github.com/xiaokexiang/db-cli/internal/database"
)

// GetCreateTable generates a CREATE TABLE statement for a given table
func GetCreateTable(db *gorm.DB, tableName string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("database connection cannot be nil")
	}
	if tableName == "" {
		return "", fmt.Errorf("table name is required")
	}

	// Detect database type
	dbType := detectDBType(db)

	if dbType == "dameng" {
		return getCreateTableDameng(db, tableName)
	}
	return getCreateTableMySQL(db, tableName)
}

// getCreateTableMySQL generates CREATE TABLE for MySQL
func getCreateTableMySQL(db *gorm.DB, tableName string) (string, error) {
	// Get column information
	columns, err := database.GetTableColumns(db, tableName)
	if err != nil {
		return "", fmt.Errorf("failed to get table columns: %w", err)
	}

	if len(columns) == 0 {
		return "", fmt.Errorf("table %s not found or has no columns", tableName)
	}

	// Get index information for PRIMARY KEY detection
	indexes, err := database.GetIndexes(db, tableName)
	if err != nil {
		return "", fmt.Errorf("failed to get indexes: %w", err)
	}

	// Build CREATE TABLE statement
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("CREATE TABLE `%s` (\n", tableName))

	// Build column definitions
	for i, col := range columns {
		if i > 0 {
			builder.WriteString(",\n")
		}

		fieldName, _ := col["Field"].(string)
		colType, _ := col["Type"].(string)
		isNullable, _ := col["Null"].(string)
		defaultVal, hasDefault := col["Default"]
		extra, _ := col["Extra"].(string)

		builder.WriteString(fmt.Sprintf("  `%s` %s", fieldName, colType))

		// Add NULL/NOT NULL
		if isNullable == "NO" {
			builder.WriteString(" NOT NULL")
		}

		// Add DEFAULT
		if hasDefault && defaultVal != nil {
			defaultStr := fmt.Sprintf("%v", defaultVal)
			// Check if default is a function like CURRENT_TIMESTAMP
			if strings.HasSuffix(strings.ToUpper(defaultStr), "()") {
				builder.WriteString(fmt.Sprintf(" DEFAULT %s", defaultStr))
			} else if defaultStr == "NULL" {
				builder.WriteString(" DEFAULT NULL")
			} else {
				// Quote string defaults
				if isStringType(colType) {
					builder.WriteString(fmt.Sprintf(" DEFAULT '%s'", escapeString(defaultStr)))
				} else {
					builder.WriteString(fmt.Sprintf(" DEFAULT %s", defaultStr))
				}
			}
		}

		// Add AUTO_INCREMENT
		if strings.Contains(strings.ToUpper(extra), "AUTO_INCREMENT") {
			builder.WriteString(" AUTO_INCREMENT")
		}

		// Add PRIMARY KEY inline for auto_increment columns
		if strings.Contains(strings.ToUpper(extra), "AUTO_INCREMENT") {
			builder.WriteString(" PRIMARY KEY")
		}
	}

	// Add PRIMARY KEY for non-auto_increment primary keys
	primaryKeys := detectPrimaryKeys(indexes)
	if len(primaryKeys) > 0 {
		// Check if any primary key is already defined inline (auto_increment)
		hasInlinePK := false
		for _, col := range columns {
			extra, _ := col["Extra"].(string)
			if strings.Contains(strings.ToUpper(extra), "AUTO_INCREMENT") {
				hasInlinePK = true
				break
			}
		}

		if !hasInlinePK {
			builder.WriteString(",\n")
			builder.WriteString("  PRIMARY KEY (")
			for i, pk := range primaryKeys {
				if i > 0 {
					builder.WriteString(", ")
				}
				builder.WriteString(fmt.Sprintf("`%s`", pk))
			}
			builder.WriteString(")")
		}
	}

	builder.WriteString("\n)")

	// Get table options (engine, charset, etc.)
	// For simplicity, we'll use common defaults
	builder.WriteString(" ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")

	return builder.String(), nil
}

// getCreateTableDameng generates CREATE TABLE for Dameng
func getCreateTableDameng(db *gorm.DB, tableName string) (string, error) {
	// Get column information
	columns, err := database.GetTableColumns(db, tableName)
	if err != nil {
		return "", fmt.Errorf("failed to get table columns: %w", err)
	}

	if len(columns) == 0 {
		return "", fmt.Errorf("table %s not found or has no columns", tableName)
	}

	// Get index information for PRIMARY KEY detection
	indexes, err := database.GetIndexes(db, tableName)
	if err != nil {
		return "", fmt.Errorf("failed to get indexes: %w", err)
	}

	// Build CREATE TABLE statement
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("CREATE TABLE \"%s\" (\n", strings.ToUpper(tableName)))

	// Build column definitions
	for i, col := range columns {
		if i > 0 {
			builder.WriteString(",\n")
		}

		fieldName, _ := col["Field"].(string)
		colType, _ := col["Type"].(string)
		isNullable, _ := col["Null"].(string)
		defaultVal, hasDefault := col["Default"]

		builder.WriteString(fmt.Sprintf("  \"%s\" %s", strings.ToUpper(fieldName), colType))

		// Add NULL/NOT NULL
		if isNullable == "NO" {
			builder.WriteString(" NOT NULL")
		}

		// Add DEFAULT
		if hasDefault && defaultVal != nil {
			defaultStr := fmt.Sprintf("%v", defaultVal)
			if defaultStr == "NULL" {
				builder.WriteString(" DEFAULT NULL")
			} else {
				// Quote string defaults
				if isStringType(colType) {
					builder.WriteString(fmt.Sprintf(" DEFAULT '%s'", escapeString(defaultStr)))
				} else {
					builder.WriteString(fmt.Sprintf(" DEFAULT %s", defaultStr))
				}
			}
		}
	}

	// Add PRIMARY KEY from index information
	primaryKeys := detectPrimaryKeys(indexes)
	if len(primaryKeys) > 0 {
		builder.WriteString(",\n")
		builder.WriteString("  PRIMARY KEY (")
		for i, pk := range primaryKeys {
			if i > 0 {
				builder.WriteString(", ")
			}
			builder.WriteString(fmt.Sprintf("\"%s\"", strings.ToUpper(pk)))
		}
		builder.WriteString(")")
	}

	builder.WriteString("\n);")

	return builder.String(), nil
}

// detectDBType detects the database type from the connection
func detectDBType(db *gorm.DB) string {
	if db == nil {
		return "mysql"
	}

	// Check dialect name
	dia := db.Dialector.Name()
	if strings.Contains(strings.ToLower(dia), "dameng") ||
	   strings.Contains(strings.ToLower(dia), "dm") {
		return "dameng"
	}

	// Default to MySQL
	return "mysql"
}

// detectPrimaryKeys extracts primary key column names from index information
func detectPrimaryKeys(indexes []map[string]interface{}) []string {
	var primaryKeys []string

	for _, idx := range indexes {
		keyName, ok := idx["Key_name"].(string)
		if !ok || keyName != "PRIMARY" {
			continue
		}

		colName, ok := idx["Column_name"].(string)
		if ok && colName != "" {
			primaryKeys = append(primaryKeys, colName)
		}
	}

	return primaryKeys
}

// isStringType checks if a column type is a string type
func isStringType(colType string) bool {
	upperType := strings.ToUpper(colType)
	stringTypes := []string{"VARCHAR", "CHAR", "TEXT", "TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "BLOB", "JSON"}

	for _, st := range stringTypes {
		if strings.Contains(upperType, st) {
			return true
		}
	}
	return false
}

// escapeString escapes special characters in a string for SQL
func escapeString(s string) string {
	escaped := strings.ReplaceAll(s, "'", "''")
	escaped = strings.ReplaceAll(escaped, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, "\n", "\\n")
	escaped = strings.ReplaceAll(escaped, "\r", "\\r")
	return escaped
}
