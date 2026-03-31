# Phase 2: Schema Inspection & Import/Export - Discussion Log (Assumptions Mode)

**Date:** 2026-03-31
**Phase:** 02-schema-inspection-import-export
**Mode:** assumptions
**Areas analyzed:** Command design, DESC command features, Export command features, Output format extensions, Dameng preparation, Code reuse from Phase 1

## Assumptions Presented

### Command Design
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| desc command: `db-cli desc [flags]` | Confident | REQUIREMENTS.md DESC-01~04, Phase 1 exec pattern |
| export command: `db-cli export [flags] --query/--table --output` | Confident | REQUIREMENTS.md IO-02/IO-03 |
| Reuse Phase 1 global flags | Confident | Phase 1 cmd/root.go already defines all flags |

### DESC Command Features
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| --table shows Field/Type/Null/Key/Default/Extra | Confident | REQUIREMENTS.md DESC-01, MySQL DESCRIBE standard |
| --indexes shows table index info | Confident | REQUIREMENTS.md DESC-02 |
| --foreign-keys shows FK constraints | Confident | REQUIREMENTS.md DESC-03 |
| --databases lists all databases | Confident | REQUIREMENTS.md DESC-04 |
| --tables lists all tables | Confident | REQUIREMENTS.md DESC-04 |

### Export Command Features
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| --query exports query results | Confident | REQUIREMENTS.md IO-02 |
| --table exports structure + data | Confident | REQUIREMENTS.md IO-03 |
| --format=insert generates INSERT statements | Confident | REQUIREMENTS.md IO-02 |
| --format=ddl generates CREATE TABLE | Confident | REQUIREMENTS.md IO-02 |

### Output Format Extensions
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| --format=table uses ASCII table (tablewriter) | Likely | REQUIREMENTS.md DQL-02, common Go pattern |
| --format=csv with --csv-delimiter flag | Confident | REQUIREMENTS.md DQL-02 "supports custom delimiter" |
| JSON remains default | Confident | Phase 1 DQL-01 precedent |

### Dameng Preparation
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| CONN-03: infrastructure only, defer full support | Likely | ROADMAP.md places Dameng in Phase 4 |
| Connection layer already supports DBType switching | Confident | Phase 1 connection.go has DBType field |

### Code Reuse
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Reuse internal/database/connection.go | Confident | Phase 1 verified code |
| Extend internal/output/json.go | Confident | Established package structure |
| Same error handling as exec | Confident | Phase 1 error_handler.go |

## Corrections Made

No corrections — all assumptions confirmed by user.

## External Research

None — all decisions based on existing requirements and Phase 1 code patterns.

---

*Generated: 2026-03-31 via assumptions mode*
