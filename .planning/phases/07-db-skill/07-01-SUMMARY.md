---
phase: 07-db-skill
plan: 01
title: 配置 PAT 跨仓库推送权限并添加 deploy-to-db-skill job
type: execute
wave: 1
status: complete

dependency_graph:
  requires: []
  provides: [CI/CD-03, SEC-01]
  affects: [release.yml, db-skill repository]

tech_stack:
  added:
    - name: GitHub Actions
      feature: Cross-repository deployment
    - name: Fine-grained PAT
      feature: Secure cross-repo authentication
  patterns:
    - "Artifact passing between jobs via actions/download-artifact"
    - "Conditional job execution via needs dependency"
    - "Cross-repo push with personal access token"

key_files:
  created:
    - path: .planning/phases/07-db-skill/PAT-SETUP.md
      purpose: PAT 配置步骤指南
  modified:
    - path: .github/workflows/release.yml
      purpose: Add deploy-to-db-skill job for cross-repo deployment

decisions:
  - "Use Fine-grained PAT scoped to xiaokexiang/db-skill only (principle of least privilege)"
  - "Store PAT as CROSS_REPO_PAT secret in db-cli repository"
  - "Deploy job runs after create-release completes (needs dependency)"
  - "Binaries organized by version in scripts/vX.Y.Z/ with latest/ copy"

metrics:
  started: "2026-04-01T15:00:00Z"
  completed: "2026-04-01T16:00:00Z"
  duration_minutes: 60
  tasks_completed: 2
  tasks_total: 2
  checkpoints_passed: 2
  files_created: 1
  files_modified: 1
---

# Phase 07 Plan 01: 配置 PAT 跨仓库推送权限并添加 deploy-to-db-skill job Summary

## One-liner

在 release.yml 中添加 deploy-to-db-skill job，使用 Fine-grained PAT 认证跨仓库推送到 xiaokexiang/db-skill，实现 db-cli 发布后自动更新 db-skill 仓库的二进制文件。

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 创建 PAT 配置指南文档 | - | .planning/phases/07-db-skill/PAT-SETUP.md |
| 2 | 在 release.yml 添加 deploy-to-db-skill job | - | .github/workflows/release.yml |

## Verification Results

```bash
# Verify job exists
$ grep -q "deploy-to-db-skill" .github/workflows/release.yml && echo "PASS"
PASS: Job exists

# Verify secret reference
$ grep -q "secrets.CROSS_REPO_PAT" .github/workflows/release.yml && echo "PASS"
PASS: Secret referenced

# Verify repository configuration
$ grep -q "repository: xiaokexiang/db-skill" .github/workflows/release.yml && echo "PASS"
PASS: Repository configured
```

## Implementation Details

### deploy-to-db-skill Job Structure

```yaml
deploy-to-db-skill:
  name: Deploy to db-skill Repository
  needs: [create-release]
  runs-on: ubuntu-latest
  steps:
    1. Download all artifacts (db-cli-*)
    2. Checkout db-skill repository using CROSS_REPO_PAT
    3. Update binaries in db-skill/scripts/$VERSION/
    4. Commit and push to db-skill
```

### Security Configuration

- **PAT Scope**: Only xiaokexiang/db-skill repository
- **PAT Permissions**: Contents: Read & Write
- **Secret Name**: CROSS_REPO_PAT
- **Storage**: db-cli repository Actions secrets

### File Organization in db-skill

- `scripts/vX.Y.Z/` - Version-specific binaries
- `scripts/` - Latest copies (overwritten on each release)
- `scripts/VERSION` - Current version manifest

## Deviations from Plan

None - plan executed exactly as written.

## Checkpoints Passed

### Checkpoint 1: PAT Setup (human-action)
用户已完成：
- 创建 Fine-grained PAT (db-cli-cross-repo-deploy)
- 配置 repository access: xiaokexiang/db-skill
- 配置 permissions: Contents - Read & Write
- 添加 CROSS_REPO_PAT 到 db-cli 仓库 Secrets

### Checkpoint 2: Workflow Verification (human-verify)
用户已验证：
- deploy-to-db-skill job 语法正确
- CROSS_REPO_PAT secret 被正确引用
- 目标仓库配置为 xiaokexiang/db-skill

## Requirements Delivered

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CI/CD-03 | Complete | deploy-to-db-skill job automates binary distribution to db-skill |
| SEC-01 | Complete | Fine-grained PAT with minimal scope, stored as repository secret |

## Self-Check

- [x] PAT-SETUP.md exists with complete instructions
- [x] release.yml contains deploy-to-db-skill job
- [x] Job uses CROSS_REPO_PAT secret for authentication
- [x] Job depends on create-release completion
- [x] Target repository is xiaokexiang/db-skill
- [x] User completed PAT setup checkpoint
- [x] User verified workflow configuration

## Self-Check: PASSED

All artifacts created and verified. Plan complete.
