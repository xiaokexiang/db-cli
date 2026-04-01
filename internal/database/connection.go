package database

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

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
	// For Dameng, database (schema) is optional - defaults to username
	if cfg.Database == "" && cfg.DBType != "dameng" {
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
		// Use url.QueryEscape to handle special characters in password
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.User,
			url.QueryEscape(cfg.Password),
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
		// Dameng DSN format: dm://user:password@host:port?schema=database
		// Driver: github.com/godoes/gorm-dameng (GORM DM8 driver)
		// Note: DSN must start with dm:// for the dameng driver
		// For Dameng, schema typically matches the username (e.g., SYSDBA)
		schema := cfg.Database
		if schema == "" {
			schema = cfg.User // Default to username as schema
		}
		dsn := fmt.Sprintf("dm://%s:%s@%s:%d?schema=%s",
			cfg.User,
			url.QueryEscape(cfg.Password),
			cfg.Host,
			port,
			schema,
		)
		return dsn, nil
	default:
		return "", fmt.Errorf("unsupported database type: %s", cfg.DBType)
	}
}

// OpenConnection opens a GORM database connection
// If database is empty, uses default (mysql for MySQL, username for Dameng)
func OpenConnection(cfg ConnectionConfig) (*gorm.DB, error) {
	// Apply default database if not specified
	connCfg := cfg
	if connCfg.Database == "" {
		switch connCfg.DBType {
		case "mysql", "":
			connCfg.Database = "mysql"
		case "dameng":
			connCfg.Database = connCfg.User // Default to username as schema
		}
	}

	dsn, err := BuildDSN(connCfg)
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

// TestConnection tests if the database connection is working
// Returns nil if connection is successful, error otherwise
// If database is empty, uses default (mysql for MySQL, username for Dameng)
func TestConnection(cfg ConnectionConfig) error {
	// Apply default database if not specified
	testCfg := cfg
	if testCfg.Database == "" {
		switch testCfg.DBType {
		case "mysql", "":
			testCfg.Database = "mysql"
		case "dameng":
			testCfg.Database = testCfg.User // Default to username as schema
		}
	}

	// Open database connection
	db, err := OpenConnection(testCfg)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer func() {
		if closeErr := CloseConnection(db); closeErr != nil {
			fmt.Printf("Warning: failed to close connection: %v\n", closeErr)
		}
	}()

	// Execute a simple ping query
	var result int
	if err := db.Raw("SELECT 1").Scan(&result).Error; err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	return nil
}

// ParseDSN parses a DSN URL string into ConnectionConfig
// Format: type://user:password@host:port/database
// Examples:
//   - mysql://root:password@localhost:3306/mydb
//   - mysql://root:password@localhost:3306 (database defaults to "mysql")
//   - dameng://SYSDBA:SYSDBA001@10.50.8.44:5236 (database defaults to username)
func ParseDSN(dsnURL string) (ConnectionConfig, error) {
	cfg := ConnectionConfig{}

	// Handle empty DSN
	if dsnURL == "" {
		return cfg, fmt.Errorf("empty DSN")
	}

	// Parse URL
	u, err := url.Parse(dsnURL)
	if err != nil {
		return cfg, fmt.Errorf("invalid DSN format: %w", err)
	}

	// Extract database type from scheme
	cfg.DBType = u.Scheme
	if cfg.DBType != "mysql" && cfg.DBType != "dameng" {
		return cfg, fmt.Errorf("unsupported database type: %s (use 'mysql' or 'dameng')", cfg.DBType)
	}

	// Extract user info (user:password)
	if u.User != nil {
		cfg.User = u.User.Username()
		if password, ok := u.User.Password(); ok {
			cfg.Password = password
		}
	}

	// Extract host and port
	host, portStr, err := parseHostPort(u.Host)
	if err != nil {
		return cfg, fmt.Errorf("invalid host:port format: %w", err)
	}
	cfg.Host = host

	// Parse port
	if portStr != "" {
		port, err := strconv.Atoi(portStr)
		if err != nil {
			return cfg, fmt.Errorf("invalid port: %s", portStr)
		}
		cfg.Port = port
	}

	// Extract database name from path (remove leading /)
	cfg.Database = strings.TrimPrefix(u.Path, "/")
	// If database not specified in DSN, use default based on database type
	if cfg.Database == "" {
		switch cfg.DBType {
		case "mysql":
			cfg.Database = "mysql" // Default to mysql system database
		case "dameng":
			// For Dameng, default to username as schema (handled in BuildDSN)
			cfg.Database = ""
		}
	}

	return cfg, nil
}

// parseHostPort parses host and port from a hostport string
// Returns host, port, error
func parseHostPort(hostport string) (host, port string, err error) {
	// Check for IPv6 address [::1]:port
	if strings.HasPrefix(hostport, "[") {
		// IPv6: [::1]:port or [::1]
		end := strings.Index(hostport, "]")
		if end == -1 {
			return "", "", fmt.Errorf("invalid IPv6 address")
		}
		host = hostport[1:end]
		if len(hostport) > end+1 && hostport[end+1] == ':' {
			port = hostport[end+2:]
		}
		return host, port, nil
	}

	// IPv4: host:port or host
	lastColon := strings.LastIndex(hostport, ":")
	if lastColon == -1 {
		return hostport, "", nil
	}
	return hostport[:lastColon], hostport[lastColon+1:], nil
}
