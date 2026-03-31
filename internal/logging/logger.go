package logging

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	// DefaultLogDir is the default directory for log files
	DefaultLogDir = ".db-cli"
	// HistoryLogFile is the name of the history log file
	HistoryLogFile = "history.log"
	// ErrorLogFile is the name of the error log file
	ErrorLogFile = "error.log"
	// MaxLogSize is the maximum size of log file before rotation (10MB)
	MaxLogSize = 10 * 1024 * 1024
	// LogFilePerm is the file permission for log files
	LogFilePerm = 0600
)

// LogEntry represents a command execution log entry
type LogEntry struct {
	Timestamp  string   `json:"timestamp"`
	Command    string   `json:"command"`
	Args       []string `json:"args,omitempty"`
	ExitCode   int      `json:"exit_code"`
	DurationMs int64    `json:"duration_ms,omitempty"`
}

// ErrorEntry represents an error log entry
type ErrorEntry struct {
	Timestamp string `json:"timestamp"`
	Command   string `json:"command"`
	Args      []string `json:"args,omitempty"`
	ErrorCode int    `json:"error_code"`
	Message   string `json:"message"`
}

// Logger manages logging for the application
type Logger struct {
	mu         sync.Mutex
	historyLog *os.File
	errorLog   *os.File
	noLog      bool // true if DB_CLI_NOLOG is set
	initialized bool
}

var (
	loggerInstance *Logger
	loggerOnce     sync.Once
)

// GetLogger returns the singleton logger instance
func GetLogger() *Logger {
	loggerOnce.Do(func() {
		loggerInstance = &Logger{}
		if err := loggerInstance.init(); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to initialize logger: %v\n", err)
		}
	})
	return loggerInstance
}

// init initializes the logger
func (l *Logger) init() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.initialized {
		return nil
	}

	// Check if logging is disabled
	l.noLog = os.Getenv("DB_CLI_NOLOG") == "1"
	if l.noLog {
		l.initialized = true
		return nil
	}

	// Get home directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	// Create log directory
	logDir := filepath.Join(homeDir, DefaultLogDir)
	if err := os.MkdirAll(logDir, 0700); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	// Open history log file
	historyPath := filepath.Join(logDir, HistoryLogFile)
	if err := l.openLogFile(&l.historyLog, historyPath); err != nil {
		return fmt.Errorf("failed to open history log: %w", err)
	}

	// Open error log file
	errorPath := filepath.Join(logDir, ErrorLogFile)
	if err := l.openLogFile(&l.errorLog, errorPath); err != nil {
		return fmt.Errorf("failed to open error log: %w", err)
	}

	l.initialized = true
	return nil
}

// openLogFile opens or creates a log file with rotation
func (l *Logger) openLogFile(file **os.File, path string) error {
	// Check if file exists and get size
	info, err := os.Stat(path)
	if err == nil && info.Size() >= MaxLogSize {
		// Rotate log file
		backupPath := path + ".1"
		if err := os.Rename(path, backupPath); err != nil {
			// If rename fails, truncate the file
			if err := os.Truncate(path, 0); err != nil {
				return err
			}
		}
	}

	// Open file with append mode, create if not exists
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, LogFilePerm)
	if err != nil {
		return err
	}

	*file = f
	return nil
}

// LogCommand logs a command execution
func (l *Logger) LogCommand(command string, args []string, exitCode int, duration time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.noLog || !l.initialized || l.historyLog == nil {
		return
	}

	entry := LogEntry{
		Timestamp:  time.Now().Format(time.RFC3339),
		Command:    command,
		Args:       redactPassword(args),
		ExitCode:   exitCode,
		DurationMs: duration.Milliseconds(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return // Don't fail on logging errors
	}

	l.historyLog.Write(data)
	l.historyLog.Write([]byte("\n"))
}

// LogError logs an error
func (l *Logger) LogError(command string, args []string, errorCode int, message string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.noLog || !l.initialized || l.errorLog == nil {
		return
	}

	entry := ErrorEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Command:   command,
		Args:      redactPassword(args),
		ErrorCode: errorCode,
		Message:   message,
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return // Don't fail on logging errors
	}

	l.errorLog.Write(data)
	l.errorLog.Write([]byte("\n"))
}

// redactPassword replaces password values with ***
func redactPassword(args []string) []string {
	result := make([]string, len(args))
	copy(result, args)

	for i := 0; i < len(result)-1; i++ {
		arg := result[i]
		// Handle -p flag
		if arg == "-p" {
			result[i+1] = "***"
		}
		// Handle --password flag
		if arg == "--password" {
			result[i+1] = "***"
		}
		// Handle --password=value format
		if len(arg) > 11 && arg[:11] == "--password=" {
			result[i] = "--password=***"
		}
	}

	return result
}

// Close closes the logger
func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.historyLog != nil {
		l.historyLog.Close()
	}
	if l.errorLog != nil {
		l.errorLog.Close()
	}
}

// InitLogger initializes the global logger (for backward compatibility)
func InitLogger() error {
	return GetLogger().init()
}
