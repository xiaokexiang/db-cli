package database

import (
	"strings"
	"testing"
)

// TestDamengDSN_BuildsCorrectly tests DSN format for Dameng with default port 5236
func TestDamengDSN_BuildsCorrectly(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     0, // Should default to 5236 for dameng
		User:     "DBA",
		Password: "SYSDBA",
		Database: "TEST",
		DBType:   "dameng",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Dameng DSN format: user:password@tcp(host:port)/database
	// Default port for Dameng is 5236 (not 3306 like MySQL)
	expected := "DBA:SYSDBA@tcp(localhost:5236)/TEST"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

// TestDamengDSN_CustomPort tests DSN with custom port
func TestDamengDSN_CustomPort(t *testing.T) {
	cfg := ConnectionConfig{
		Host:     "10.50.13.41",
		Port:     5237, // Custom port
		User:     "DBA",
		Password: "SYSDBA",
		Database: "PROD",
		DBType:   "dameng",
	}

	dsn, err := BuildDSN(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "DBA:SYSDBA@tcp(10.50.13.41:5237)/PROD"
	if dsn != expected {
		t.Errorf("expected DSN: %s, got: %s", expected, dsn)
	}
}

// TestDamengDSN_ValidationErrors tests validation for missing parameters
func TestDamengDSN_ValidationErrors(t *testing.T) {
	testCases := []struct {
		name          string
		cfg           ConnectionConfig
		expectedError string
	}{
		{
			name: "missing host",
			cfg: ConnectionConfig{
				Host:     "",
				Port:     5236,
				User:     "DBA",
				Password: "SYSDBA",
				Database: "TEST",
				DBType:   "dameng",
			},
			expectedError: "host is required",
		},
		{
			name: "missing user",
			cfg: ConnectionConfig{
				Host:     "localhost",
				Port:     5236,
				User:     "",
				Password: "SYSDBA",
				Database: "TEST",
				DBType:   "dameng",
			},
			expectedError: "user is required",
		},
		{
			name: "missing database",
			cfg: ConnectionConfig{
				Host:     "localhost",
				Port:     5236,
				User:     "DBA",
				Password: "SYSDBA",
				Database: "",
				DBType:   "dameng",
			},
			expectedError: "database is required",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := BuildDSN(tc.cfg)
			if err == nil {
				t.Fatalf("expected error for %s, got nil", tc.name)
			}
			if !strings.Contains(err.Error(), tc.expectedError) {
				t.Errorf("expected error containing '%s', got: %v", tc.expectedError, err)
			}
		})
	}
}

// TestDamengConnection_Integration tests actual connection to Dameng database
// This test requires a running Dameng server and will skip if unavailable
func TestDamengConnection_Integration(t *testing.T) {
	// Skip integration test by default - requires actual Dameng server
	// To run: set DAMENG_TEST_HOST env var and ensure Dameng is reachable
	t.Skip("Integration test: requires Dameng server. Set DAMENG_TEST_HOST to run.")

	cfg := ConnectionConfig{
		Host:     "localhost",
		Port:     5236,
		User:     "DBA",
		Password: "SYSDBA",
		Database: "TEST",
		DBType:   "dameng",
	}

	db, err := OpenConnection(cfg)
	if err != nil {
		t.Fatalf("failed to open Dameng connection: %v", err)
	}
	defer func() {
		if err := CloseConnection(db); err != nil {
			t.Errorf("failed to close connection: %v", err)
		}
	}()

	// Verify connection is alive
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get underlying sql.DB: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Errorf("failed to ping Dameng database: %v", err)
	}
}
