package cmd

import (
	"testing"
)

// TestExecCommand_Exists verifies the exec command is registered
func TestExecCommand_Exists(t *testing.T) {
	// Check that execCmd exists and is properly configured
	if execCmd == nil {
		t.Fatal("execCmd should not be nil")
	}

	if execCmd.Use == "" {
		t.Error("execCmd.Use should be set")
	}

	if execCmd.Short == "" {
		t.Error("execCmd.Short should be set")
	}

	if execCmd.RunE == nil {
		t.Error("execCmd.RunE should be set")
	}
}

// TestExecCommand_HasFileFlag verifies --file flag is defined
func TestExecCommand_HasFileFlag(t *testing.T) {
	fileFlag := execCmd.Flags().Lookup("file")
	if fileFlag == nil {
		t.Error("exec command should have --file flag")
	}
}

// TestExecCommand_HasFormatFlag verifies --format flag is defined
func TestExecCommand_HasFormatFlag(t *testing.T) {
	formatFlag := execCmd.Flags().Lookup("format")
	if formatFlag == nil {
		t.Error("exec command should have --format flag")
	}
}

// TestExecCommand_HasAutocommitFlag verifies --autocommit flag is defined
func TestExecCommand_HasAutocommitFlag(t *testing.T) {
	autocommitFlag := execCmd.Flags().Lookup("autocommit")
	if autocommitFlag == nil {
		t.Error("exec command should have --autocommit flag")
	}
}

// TestExecCommand_FormatDefaultIsJSON verifies default format is json
func TestExecCommand_FormatDefaultIsJSON(t *testing.T) {
	formatFlag := execCmd.Flags().Lookup("format")
	if formatFlag == nil {
		t.Fatal("format flag should exist")
	}

	defaultValue := formatFlag.DefValue
	if defaultValue != "json" {
		t.Errorf("expected default format to be 'json', got '%s'", defaultValue)
	}
}
