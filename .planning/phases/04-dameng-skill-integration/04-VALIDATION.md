# Phase 4: Dameng & Skill Integration - Validation Strategy

**Created:** 2026-03-31
**Nyquist Version:** 1.0

---

## Validation Overview

| Requirement | Test Type | Automated Command | Wave |
|-------------|-----------|-------------------|------|
| CONN-03 (达梦数据库连接) | Integration | `go test ./internal/database -run TestDameng` | Wave 1 |
| SKILL-01 (Claude Code Skill) | Unit + Integration | `npm test` (db-cli-skill) | Wave 2 |
| SKILL-02 (自动下载) | Integration | Manual verification | Wave 2 |

---

## Wave 0 Gaps

| File | Purpose | Priority |
|------|---------|----------|
| `internal/database/connection_dameng_test.go` | Dameng connection tests | Wave 1 (Plan 04-01) |
| `db-cli-skill/src/templates/matcher.test.ts` | Template matching unit tests | Wave 2 (Plan 04-03) |
| `db-cli-skill/src/installer/download.test.ts` | GitHub download tests | Wave 2 (Plan 04-04) |

---

## Sampling Rate

- **Per task commit:** `go test ./... -short` + `npm test` (db-cli-skill)
- **Per wave merge:** `go test ./...` + `npm test` (full suite)
- **Phase gate:** All tests green before `/gsd:verify-work`

---

## Dameng Connection Tests (Wave 1)

### Test Cases

| Test | Purpose | Type |
|------|---------|------|
| `TestDamengDSN_BuildsCorrectly` | DSN format with default port 5236 | Unit |
| `TestDamengDSN_CustomPort` | DSN with custom port | Unit |
| `TestDamengDSN_ValidationErrors` | Missing host/user/database returns error | Unit |
| `TestDamengConnection_Integration` | Actual connection (skip if unavailable) | Integration |

### Success Criteria

- [ ] All unit tests pass
- [ ] Integration test skips gracefully if Dameng server unavailable
- [ ] `go build ./...` succeeds

---

## Skill Tests (Wave 2)

### Template Matcher Tests

| Test | Purpose |
|------|---------|
| `matchUserIntent_count` | "how many rows in table X" → count tool |
| `matchUserIntent_desc` | "describe table X" → desc tool |
| `matchUserIntent_export` | "export table X to file" → export tool |
| `matchUserIntent_import` | "import SQL file X" → import tool |
| `matchUserIntent_exec` | "run SQL: SELECT..." → exec tool |
| `matchUserIntent_noMatch` | Unmatched input returns null |

### Binary Download Tests

| Test | Purpose |
|------|---------|
| `downloadLatestRelease_success` | Downloads latest release |
| `downloadLatestRelease_platform` | Selects correct platform asset |
| `downloadLatestRelease_notFound` | Throws on missing release |
| `installSkill_success` | Full installation flow |

### Success Criteria

- [ ] Template matcher correctly parses all 5 command types
- [ ] Binary download works (mocked GitHub API)
- [ ] Platform detection returns correct suffix

---

## CGO Build Mitigation

**Strategy:** Pre-built binaries via GitHub Releases (D-13)

- Wave 1: MySQL-only build (CGO_ENABLED=0) for MVP
- Dameng CGO builds: Separate workflow with pre-built binaries
- Users install Dameng client libraries separately if needed

---

## Verification Commands

### Wave 1 (Go - Dameng Driver)
```bash
# Build
go build ./...

# Unit tests
go test ./internal/database -run TestDamengDSN -v

# Integration (may skip)
go test ./internal/database -run TestDamengConnection -v
```

### Wave 2 (TypeScript - Skill)
```bash
cd db-cli-skill

# Build
npm run build

# Unit tests
npm test

# Full suite
npm run test:ci
```

---

## Phase Gate Checklist

Before `/gsd:verify-work`:

- [ ] Wave 1: All Go tests pass
- [ ] Wave 2: All TypeScript tests pass
- [ ] Dameng connection works (if server available)
- [ ] Skill tools respond to MCP calls
- [ ] Binary download/install works
- [ ] Cross-platform builds succeed (GitHub Actions)
