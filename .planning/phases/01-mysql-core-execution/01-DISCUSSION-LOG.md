# Phase 1: MySQL Core Execution - Discussion Log (Assumptions Mode)

**Date:** 2026-03-31
**Phase:** 01-mysql-core-execution
**Mode:** assumptions
**Areas analyzed:** CLI framework, connection handling, MySQL driver, Dameng driver, command design, error handling, transaction control, output format, build strategy

## Assumptions Presented

### CLI Framework
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Use Cobra framework with cmd/ subcommand structure | Confident | CLAUDE.md specifies cobra as recommended CLI framework |
| Commands: root.go, exec.go, import.go | Confident | REQUIREMENTS.md EXEC-01, EXEC-02, IO-01 |

### Connection Handling
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Flags: -h/-P/-u/-p/-d/-t for connection params | Confident | REQUIREMENTS.md CONN-01 |
| --password=- reads from stdin | Confident | REQUIREMENTS.md CONN-01 |
| GORM DB initialized per execution | Confident | PROJECT.md "no config" design principle |

### MySQL Driver
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| go-sql-driver/mysql v1.9.3 | Confident | CLAUDE.md tech stack |

### Dameng Driver
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| dm-go-driver/v2 for DM8+ | Likely | User-provided Dameng official docs URL |
| Requires CGO | Likely | Common pattern for database drivers with client libs |
| Import path TBD | Likely | Needs verification via Context7 |

### Command Design
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| exec [flags] '<SQL>' or --file=xxx.sql | Confident | REQUIREMENTS.md EXEC-01, EXEC-02 |
| import reuses exec file logic | Confident | REQUIREMENTS.md IO-01 "等价于 exec --file" |

### Error Handling
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Stop on error, non-zero exit code | Confident | REQUIREMENTS.md EXEC-03 |

### Transaction Control
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| --autocommit flag controls commit behavior | Confident | REQUIREMENTS.md EXEC-04 |

### Output Format
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Default JSON array output | Confident | REQUIREMENTS.md DQL-01 |
| --format=table/csv supported | Confident | REQUIREMENTS.md DQL-02 |

### Build Strategy
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single binary, cross-platform | Confident | REQUIREMENTS.md PLATFORM-01, PLATFORM-02 |

## Corrections Made

### Dameng Driver
- **Original assumption:** Use generic dm-go-driver (unspecified version)
- **User correction:** Use official dm-go-driver/v2 for DM8+, per Dameng official docs
- **Reason:** User's Dameng version is 8.0+, requires v2 driver; provided official doc URL and community blog reference

## External Research

Network restrictions prevented fetching external documentation:
- https://eco.dameng.com/document/dm/zh-cn/app-dev/go_gorm.html (blocked)
- https://www.yanwq.com/2024/04/10/go-through-gorm-dm-db/ (blocked)

**Resolution:** Dameng driver details to be confirmed during Phase 4 planning using Context7 MCP. Phase 1 proceeds with MySQL-only focus.

---

*Generated: 2026-03-31 via assumptions mode*
