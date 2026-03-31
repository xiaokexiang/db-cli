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

	// Special characters should be preserved in DSN
	// MySQL driver handles URL encoding internally
	expected := "root:p@ss:word@tcp(localhost:3306)/testdb?charset=utf8mb4&parseTime=True&loc=Local"
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

func TestBuildDSN_DamengNotSupported(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     3306,
		User:     "root",
		Password: "pass",
		Database: "testdb",
		DBType:   "dameng",
	}

	_, err := BuildDSN(cfg)
	if err == nil {
		t.Fatal("expected error for dameng type, got nil")
	}
	if !strings.Contains(err.Error(), "dameng") {
		t.Errorf("expected dameng not supported error, got: %v", err)
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
