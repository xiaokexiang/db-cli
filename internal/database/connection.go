package database

import (
	"fmt"

	"github.com/godoes/gorm-dameng"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// ConnectionConfig holds the database connection parameters
type ConnectionConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	DBType   string // "mysql" or "dameng"
}

// NewConnectionConfig returns an empty ConnectionConfig
func NewConnectionConfig() ConnectionConfig {
	return ConnectionConfig{}
}

// BuildDSN builds a Data Source Name from the connection config
// For MySQL: returns "user:password@tcp(host:port)/database?charset=utf8mb4&parseTime=True&loc=Local"
func BuildDSN(cfg ConnectionConfig) (string, error) {
	// Validate required fields
	if cfg.Host == "" {
		return "", fmt.Errorf("host is required")
	}
	if cfg.User == "" {
		return "", fmt.Errorf("user is required")
	}
	if cfg.Database == "" {
		return "", fmt.Errorf("database is required")
	}

	// Build DSN based on database type
	switch cfg.DBType {
	case "mysql", "":
		// Default port to 3306 if not specified for MySQL
		port := cfg.Port
		if port == 0 {
			port = 3306
		}
		// MySQL DSN format: user:pass@tcp(host:port)/database?params
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.User,
			cfg.Password,
			cfg.Host,
			port,
			cfg.Database,
		)
		return dsn, nil
	case "dameng":
		// Default port to 5236 if not specified for Dameng
		port := cfg.Port
		if port == 0 {
			port = 5236
		}
		// Dameng DSN format: user:password@tcp(host:port)/database
		// Driver: github.com/godoes/gorm-dameng (GORM DM8 driver)
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
			cfg.User,
			cfg.Password,
			cfg.Host,
			port,
			cfg.Database,
		)
		return dsn, nil
	default:
		return "", fmt.Errorf("unsupported database type: %s", cfg.DBType)
	}
}

// OpenConnection opens a GORM database connection
func OpenConnection(cfg ConnectionConfig) (*gorm.DB, error) {
	dsn, err := BuildDSN(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to build DSN: %w", err)
	}

	var db *gorm.DB
	switch cfg.DBType {
	case "mysql", "":
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "dameng":
		// Open Dameng connection using gorm-dameng driver
		// Driver: github.com/godoes/gorm-dameng (GORM DM8 driver)
		// Note: This is a pure Go implementation without CGO requirements
		db, err = gorm.Open(dameng.Open(dsn), &gorm.Config{})
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.DBType)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	return db, nil
}

// CloseConnection closes the database connection
func CloseConnection(db *gorm.DB) error {
	if db == nil {
		return nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	return sqlDB.Close()
}
