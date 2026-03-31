package output

import (
	"testing"
)

func TestToTable_NilRows(t *testing.T) {
	_, err := ToTable(nil)
	if err == nil {
		t.Error("ToTable() should return error for nil rows")
	}
}

func TestToCSV_NilRows(t *testing.T) {
	_, err := ToCSV(nil, ',')
	if err == nil {
		t.Error("ToCSV() should return error for nil rows")
	}
}

func TestToCSVWithDelimiter_NilRows(t *testing.T) {
	_, err := ToCSVWithDelimiter(nil, ",")
	if err == nil {
		t.Error("ToCSVWithDelimiter() should return error for nil rows")
	}
}

func TestToCSV_EmptyDelimiter(t *testing.T) {
	// This test requires actual database connection
	// Integration testing should be done separately
	t.Skip("Skipping integration test - requires database connection")
}
