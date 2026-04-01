package database

import (
	"strings"
	"testing"
)

func TestBuildDSN_Success(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "mysql",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "root:pass@tcp(localhost:3306)/testdb?charset=utf8mb4&parseTime=True&loc=Local"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

func TestBuildDSN_DefaultPort(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     0, // Should default to 3306
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "mysql",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "root:pass@tcp(localhost:3306)/testdb?charset=utf8mb4&parseTime=True&loc=Local"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

func TestBuildDSN_MissingHost(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "mysql",
	}

	_, err := BuildDSN(cfg)
	if err == nil {
		t.Fatal("expected error for missing host, got nil")
	}
	if !strings.Contains(err.Error(), "host is required") {
		t.Errorf("expected 'host is required' error, got: %v", err)
	}
}

func TestBuildDSN_MissingUser(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "",
		Password: "pass",
		Database: "testdb",
		DBType:   "mysql",
	}

	_, err := BuildDSN(cfg)
	if err == nil {
		t.Fatal("expected error for missing user, got nil")
	}
	if !strings.Contains(err.Error(), "user is required") {
		t.Errorf("expected 'user is required' error, got: %v", err)
	}
}

func TestBuildDSN_MissingDatabase(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "",
		DBType:   "mysql",
	}

	_, err := BuildDSN(cfg)
	if err == nil {
		t.Fatal("expected error for missing database, got nil")
	}
	if !strings.Contains(err.Error(), "database is required") {
		t.Errorf("expected 'database is required' error, got: %v", err)
	}
}

func TestBuildDSN_WithSpecialChars(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "root",
		Password: "p@ss:word",
		Database: "testdb",
		DBType:   "mysql",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Special characters are URL-encoded by BuildDSN
	// @ -> %40, : -> %3A
	expected := "root:p%40ss%3Aword@tcp(localhost:3306)/testdb?charset=utf8mb4&parseTime=True&loc=Local"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

func TestBuildDSN_UnsupportedDBType(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "postgresql",
	}

	_, err := BuildDSN(cfg)
	if err == nil {
		t.Fatal("expected error for unsupported database type, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported database type") {
		t.Errorf("expected 'unsupported database type' error, got: %v", err)
	}
}

func TestBuildDSN_DamengSupported(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     5236,
		User:     "DBA",
		Password: "SYSDBA",
		Database: "TEST",
		DBType:   "dameng",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error for dameng type: %v", err)
	}
	// Verify Dameng DSN format: dm://user:password@host:port?schema=database
	expected := "dm://DBA:SYSDBA@localhost:5236?schema=TEST"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

func TestOpenConnection_InvalidDSN(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "invalid-host-that-does-not-exist",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "mysql",
	}

	db, err := OpenConnection(cfg)
	if err == nil {
		t.Fatal("expected error for invalid connection, got nil")
		if db != nil {
			t.Error("expected nil db on error")
		}
	}
	// Error is expected - connection refused or similar
}

func TestCloseConnection_NilDB(t *testing.T) {
	err := CloseConnection(nil)
	if err != nil {
		t.Errorf("expected no error for nil DB, got: %v", err)
	}
}

func TestParseDSN_MySQL_Success(t *testing.T) {
	dsn := "mysql://root:password@localhost:3306/mydb"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.DBType != "mysql" {
		t.Errorf("expected DBType 'mysql', got: %s", cfg.DBType)
	}
	if cfg.User != "root" {
		t.Errorf("expected User 'root', got: %s", cfg.User)
	}
	if cfg.Password != "password" {
		t.Errorf("expected Password 'password', got: %s", cfg.Password)
	}
	if cfg.Host != "localhost" {
		t.Errorf("expected Host 'localhost', got: %s", cfg.Host)
	}
	if cfg.Port != 3306 {
		t.Errorf("expected Port 3306, got: %d", cfg.Port)
	}
	if cfg.Database != "mydb" {
		t.Errorf("expected Database 'mydb', got: %s", cfg.Database)
	}
}

func TestParseDSN_Dameng_Success(t *testing.T) {
	dsn := "dameng://DBA:SYSDBA@10.50.13.41:5236/TEST"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.DBType != "dameng" {
		t.Errorf("expected DBType 'dameng', got: %s", cfg.DBType)
	}
	if cfg.User != "DBA" {
		t.Errorf("expected User 'DBA', got: %s", cfg.User)
	}
	if cfg.Password != "SYSDBA" {
		t.Errorf("expected Password 'SYSDBA', got: %s", cfg.Password)
	}
	if cfg.Host != "10.50.13.41" {
		t.Errorf("expected Host '10.50.13.41', got: %s", cfg.Host)
	}
	if cfg.Port != 5236 {
		t.Errorf("expected Port 5236, got: %d", cfg.Port)
	}
	if cfg.Database != "TEST" {
		t.Errorf("expected Database 'TEST', got: %s", cfg.Database)
	}
}

func TestParseDSN_NoPassword(t *testing.T) {
	dsn := "mysql://root@localhost:3306/mydb"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.User != "root" {
		t.Errorf("expected User 'root', got: %s", cfg.User)
	}
	if cfg.Password != "" {
		t.Errorf("expected empty Password, got: %s", cfg.Password)
	}
}

func TestParseDSN_NoPort(t *testing.T) {
	dsn := "mysql://root:pass@localhost/mydb"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Host != "localhost" {
		t.Errorf("expected Host 'localhost', got: %s", cfg.Host)
	}
	if cfg.Port != 0 {
		t.Errorf("expected Port 0 (to be set by connection logic), got: %d", cfg.Port)
	}
}

func TestParseDSN_Empty(t *testing.T) {
	_, err := ParseDSN("")
	if err == nil {
		t.Fatal("expected error for empty DSN, got nil")
	}
	if !strings.Contains(err.Error(), "empty DSN") {
		t.Errorf("expected 'empty DSN' error, got: %v", err)
	}
}

func TestParseDSN_InvalidURL(t *testing.T) {
	_, err := ParseDSN("not-a-valid-url")
	if err == nil {
		t.Fatal("expected error for invalid URL, got nil")
	}
}

func TestParseDSN_UnsupportedType(t *testing.T) {
	dsn := "postgresql://user:pass@localhost/db"
	_, err := ParseDSN(dsn)
	if err == nil {
		t.Fatal("expected error for unsupported database type, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported database type") {
		t.Errorf("expected 'unsupported database type' error, got: %v", err)
	}
}

func TestParseDSN_MissingDatabase(t *testing.T) {
	// MySQL DSN without database should default to "mysql"
	dsn := "mysql://root:pass@localhost:3306"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should default to "mysql" database
	if cfg.Database != "mysql" {
		t.Errorf("expected Database 'mysql', got: %s", cfg.Database)
	}
}

func TestParseDSN_SpecialCharsInPassword(t *testing.T) {
	// Password with special characters (URL encoded)
	dsn := "mysql://root:p%40ssword@localhost:3306/mydb"
	cfg, err := ParseDSN(dsn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// URL decoder should handle %40 -> @
	if cfg.Password != "p@ssword" {
		t.Errorf("expected Password 'p@ssword', got: %s", cfg.Password)
	}
}
