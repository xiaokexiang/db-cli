package cmd

import (
	"fmt"
)

// ExecutionError represents a structured error from SQL execution
type ExecutionError struct {
	Code      int
	Message   string
	Cause     error
	Statement string
	Line      int
}

// Error implements the error interface for ExecutionError
func (e ExecutionError) Error() string {
	if e.Line > 0 {
		return fmt.Sprintf("Error at line %d: %s (Code %d)", e.Line, e.Message, e.Code)
	}
	if e.Statement != "" {
		return fmt.Sprintf("Error: %s (Code %d) - Statement: %s", e.Message, e.Code, e.Statement)
	}
	return fmt.Sprintf("Error: %s (Code %d)", e.Message, e.Code)
}

// Unwrap returns the underlying cause error (for errors.Is/As support)
func (e ExecutionError) Unwrap() error {
	return e.Cause
}

// NewExecutionError creates a new ExecutionError with the given parameters
func NewExecutionError(message string, code int, cause error) ExecutionError {
	return ExecutionError{
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// NewExecutionErrorWithLine creates a new ExecutionError with line number context
func NewExecutionErrorWithLine(message string, code int, cause error, line int, statement string) ExecutionError {
	return ExecutionError{
		Code:      code,
		Message:   message,
		Cause:     cause,
		Line:      line,
		Statement: statement,
	}
}
