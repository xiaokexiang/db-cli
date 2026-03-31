---
phase: 02-schema-inspection-import-export
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - internal/output/table.go
  - internal/output/csv.go
autonomous: true
requirements:
  - DQL-02
must_haves:
  truths:
    - Query results render as ASCII table with aligned columns
    - Query results export as CSV with configurable delimiter
    - Table/CSV formatters handle NULL values correctly
  artifacts:
    - path: internal/output/table.go
      provides: ASCII table formatting
      exports: ["ToTable"]
    - path: internal/output/csv.go
      provides: CSV formatting
      exports: ["ToCSV"]
  key_links:
    - from: cmd/exec.go
      to: internal/output/table.go
      via: formatOutput function
      pattern: output\\.ToTable
    - from: cmd/exec.go
      to: internal/output/csv.go
      via: formatOutput function
      pattern: output\\.ToCSV
---

<objective>
Implement table and CSV output formatters to replace placeholder functions in exec.go

Purpose: Enable users to view query results in human-readable ASCII table format and export to CSV for spreadsheet/analysis tools

Output: Two new formatter files (table.go, csv.go) with ~50-80 lines each, fully tested
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-schema-inspection-import-export/02-CONTEXT.md
@internal/output/json.go
@cmd/exec.go
</context>

<interfaces>
<!-- Key types and contracts from existing code -->

From internal/output/json.go:
```go
// ScanRows scans all rows from sql.Rows into a slice of maps
func ScanRows(rows *sql.Rows) ([]map[string]interface{}, error)

// handleNullValue converts sql.Null* types to their underlying values or nil
func handleNullValue(val interface{}) interface{}
```

From cmd/exec.go (existing format functions):
```go
func formatOutput(rows *sql.Rows, format string) error
func outputJSON(rows *sql.Rows) error  // implemented
func outputTable(rows *sql.Rows) error // returns "not yet implemented"
func outputCSV(rows *sql.Rows) error   // returns "not yet implemented"
```
</interfaces>

<tasks>

<task type="auto">
<name>Task 1: Implement ASCII table formatter</name>
<files>internal/output/table.go</files>
<action>
Create internal/output/table.go with ToTable function that:
1. Accepts *sql.Rows and returns (string, error)
2. Uses ScanRows to get data as []map[string]interface{}
3. Calculates column widths by finding max length of each column (header + data)
4. Renders ASCII table with:
   - Header row: | Column1 | Column2 | ... |
   - Separator:  +---------+---------+-----+
   - Data rows:  | value1  | value2  | ... |
5. Handles NULL values as "NULL" string
6. Handles empty result set (returns header only or empty string)

Use standard library only (no external tablewriter dependency for MVP).

Function signature:
```go
func ToTable(rows *sql.Rows) (string, error)
```

Then update cmd/exec.go outputTable function to call output.ToTable and print result.
</action>
<verify>
<automated>go build ./... succeeds with exit code 0</automated>
<manual>internal/output/table.go contains "func ToTable" and column width calculation logic</manual>
</verify>
<done>
- internal/output/table.go created with ToTable function
- outputTable() in cmd/exec.go calls output.ToTable and prints result
- ASCII table renders with proper column alignment and separators
</done>
</task>

<task type="auto">
<name>Task 2: Implement CSV formatter</name>
<files>internal/output/csv.go</files>
<action>
Create internal/output/csv.go with ToCSV function that:
1. Accepts *sql.Rows and optional delimiter (default: comma)
2. Uses ScanRows to get data as []map[string]interface{}
3. Writes CSV with:
   - Header row with column names
   - Data rows with proper escaping (quotes around fields containing delimiter, quotes, or newlines)
4. Returns (string, error)

Function signature:
```go
func ToCSV(rows *sql.Rows, delimiter rune) (string, error)
```

Then update cmd/exec.go outputCSV function to:
1. Call output.ToCSV with delimiter from config (default: ',')
2. Print result

Note: For MVP, delimiter config can be added later. Use comma as default.
</action>
<verify>
<automated>go build ./... succeeds with exit code 0</automated>
<manual>internal/output/csv.go contains "func ToCSV" and uses encoding/csv package for proper escaping</manual>
</verify>
<done>
- internal/output/csv.go created with ToCSV function
- outputCSV() in cmd/exec.go calls output.ToCSV and prints result
- CSV output has header row and properly escaped data
</done>
</task>

<task type="auto">
<name>Task 3: Wire formatters to exec command</name>
<files>cmd/exec.go</files>
<action>
Update cmd/exec.go to use the new formatters:

1. Update outputTable() function (currently returns "not yet implemented"):
```go
func outputTable(rows *sql.Rows) error {
    result, err := output.ToTable(rows)
    if err != nil {
        return fmt.Errorf("failed to format table: %w", err)
    }
    fmt.Println(result)
    return nil
}
```

2. Update outputCSV() function:
```go
func outputCSV(rows *sql.Rows) error {
    result, err := output.ToCSV(rows, ',')
    if err != nil {
        return fmt.Errorf("failed to format CSV: %w", err)
    }
    fmt.Println(result)
    return nil
}
```

3. Verify formatOutput() already routes to these functions correctly (it does based on existing switch statement)
</action>
<verify>
<automated>go build ./... succeeds with exit code 0</automated>
<manual>cmd/exec.go outputTable and outputCSV functions no longer return "not yet implemented" errors</manual>
</verify>
<done>
- outputTable() calls output.ToTable and prints result
- outputCSV() calls output.ToCSV and prints result
- formatOutput correctly routes to both formatters
</done>
</task>

</tasks>

<verification>
Overall phase checks:
- go build ./... succeeds without errors
- go test ./... passes (existing tests still pass)
- Table formatter handles edge cases: empty results, NULL values, wide columns
- CSV formatter properly escapes special characters
</verification>

<success_criteria>
Measurable completion:
1. internal/output/table.go exists with ToTable function exported
2. internal/output/csv.go exists with ToCSV function exported
3. cmd/exec.go outputTable() and outputCSV() call the new functions
4. No compilation errors
5. Existing tests pass
</success_criteria>

<output>
After completion, create .planning/phases/02-schema-inspection-import-export/02-01-SUMMARY.md
</output>
