---
phase: 06-github-actions
plan: 01
type: execute
wave: 1
tags: [github-actions, ci/cd, release-automation, multi-arch-build]
requires: []
provides:
  - ".github/workflows/release.yml: 2-job release workflow with multi-platform build matrix"
  - "6-platform binary build automation (Windows/macOS/Linux x64+ARM64)"
  - "Automated changelog generation from git history"
  - "GitHub Release asset upload automation"
affects:
  - ".github/workflows/release.yml"
tech-stack:
  added:
    - "actions/upload-artifact@v4"
    - "actions/download-artifact@v4"
    - "actions/create-release@v1"
    - "actions/upload-release-asset@v1"
  patterns:
    - "2-job architecture (build + release)"
    - "Matrix build strategy for cross-platform binaries"
    - "Artifact download pattern with glob matching"
key-files:
  created: []
  modified:
    - ".github/workflows/release.yml"
decisions:
  - "Split workflow into build job and create-release job to fix upload_url circular dependency"
  - "Use git describe fallback to first commit for changelog generation on first tag"
  - "Keep permission minimal: only contents: write"
metrics:
  started: "2026-04-01"
  completed: "2026-04-01"
  duration_minutes: 30
  tasks_completed: 3
  files_modified: 1
  commits: 1
---

# Phase 06 Plan 01: Release Workflow Refactoring Summary

**One-liner:** Refactored release.yml from broken circular dependency architecture to clean 2-job design with build job uploading artifacts and create-release job downloading and publishing to GitHub Releases.

---

## Objective

Fix the release.yml workflow's fundamental architecture flaw where `create-release` job depended on `release` job but tried to use `github.event.release.upload_url` which only exists when release is created by external trigger, not by another job.

---

## Execution Summary

### Task 1: Refactor workflow job architecture

**Commit:** `372f645 feat(06-01): refactor release.yml to 2-job architecture`

**Changes:**
- Split workflow into two distinct jobs:
  - `build`: Matrix build across 6 platforms, uploads to GitHub Actions artifacts
  - `create-release`: Downloads artifacts, creates draft release, uploads binaries as release assets
- Removed `packages: write` permission (SEC-02 compliance)
- Removed `if: always()` condition from create-release job
- Added `actions/download-artifact@v4` with glob pattern matching

**Verification Results:**
| Check | Result |
|-------|--------|
| packages permission removed | PASS |
| if: always() removed | PASS |
| upload-artifact present | PASS |
| download-artifact present | PASS |

---

### Task 2: Fix changelog generation logic

**Commit:** `372f645 feat(06-01): refactor release.yml to 2-job architecture`

**Changes:**
- Added fallback logic for first tag scenario
- Uses `git rev-list --max-parents=0 HEAD` as fallback when no previous tag exists
- Changelog generation command: `git describe --tags --abbrev=0 HEAD^ 2>/dev/null || git rev-list --max-parents=0 HEAD`

**Implementation:**
```yaml
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || git rev-list --max-parents=0 HEAD)
CHANGELOG=$(git log ${PREV_TAG}..HEAD --pretty=format:"- %s")
```

---

### Task 3: Verify workflow configuration (Checkpoint)

**Status:** All verifications passed

**Verification checklist:**
- [x] permissions block contains only `contents: write`
- [x] create-release job has no `if: always()` condition
- [x] changelog generation has error handling
- [x] upload_url correctly sourced from `steps.create_release.outputs.upload_url`
- [x] artifact path structure matches download pattern (`dist/db-cli-*/db-cli-*`)

**Manual verification completed** - workflow configuration confirmed correct.

---

## Workflow Architecture (After)

```yaml
on: push (tags: v*)
permissions: contents: write

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix: 6 platforms (Windows/macOS/Linux x AMD64/ARM64)
    steps:
      - checkout
      - setup-go
      - build binary with version injection
      - upload-artifact@v4

  create-release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - checkout
      - download-artifact@v4 (pattern: db-cli-*)
      - generate changelog (git log with fallback)
      - create-release@v1 (draft: true)
      - upload-release-asset@v1 x6 (all 6 platforms)
```

---

## Requirements Satisfied

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| CI/CD-01 | Complete | Workflow triggers on v* tag push |
| CI/CD-02 | Complete | Generates 6 platform binaries as release assets |
| SEC-02 | Complete | Permissions reduced to `contents: write` only |

---

## Deviations from Plan

### None - Plan executed exactly as written

The 2-job architecture was implemented as specified in the plan. No Rule 1-4 deviations were needed.

---

## Verification Commands

```bash
# Verify no packages permission
grep -q "packages:" .github/workflows/release.yml && echo "FAIL" || echo "PASS: no packages"

# Verify no if: always()
grep -q "if: always()" .github/workflows/release.yml && echo "FAIL" || echo "PASS: no if: always()"

# Verify artifact actions present
grep -q "actions/upload-artifact" .github/workflows/release.yml && echo "PASS: upload-artifact"
grep -q "actions/download-artifact" .github/workflows/release.yml && echo "PASS: download-artifact"
```

All verifications passed.

---

## Self-Check: PASSED

- [x] File `.github/workflows/release.yml` exists and modified
- [x] Commit `372f645` exists in git history
- [x] All 6 platform build matrix entries present
- [x] Changelog generation with fallback logic present
- [x] Permissions block contains only `contents: write`
