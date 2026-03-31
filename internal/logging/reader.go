package logging

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ReadHistory reads the last N entries from history.log
func ReadHistory(last int) ([]LogEntry, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	logPath := filepath.Join(homeDir, DefaultLogDir, HistoryLogFile)
	entries, err := readHistoryFile(logPath, last)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

// ReadErrors reads the last N entries from error.log
func ReadErrors(last int) ([]ErrorEntry, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	logPath := filepath.Join(homeDir, DefaultLogDir, ErrorLogFile)
	entries, err := readErrorFile(logPath, last)
	if err != nil {
		return nil, err
	}
	return entries, nil
}

func readHistoryFile(path string, last int) ([]LogEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []LogEntry{}, nil
		}
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	start := 0
	if len(lines) > last {
		start = len(lines) - last
	}
	lines = lines[start:]

	var entries []LogEntry
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry LogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

func readErrorFile(path string, last int) ([]ErrorEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []ErrorEntry{}, nil
		}
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	start := 0
	if len(lines) > last {
		start = len(lines) - last
	}
	lines = lines[start:]

	var entries []ErrorEntry
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry ErrorEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}
		entries = append(entries, entry)
	}

	return entries, nil
}
