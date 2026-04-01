# db-cli Roadmap

**Generated:** 2026-03-31
**Updated:** 2026-04-01
**Current Milestone:** v1.1 IN PROGRESS

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-01) — [Archive](.planning/milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 CI/CD 自动化** — Phase 6 complete, Phase 7 planning

---

## v1.1 Roadmap

**Summary:**

| Metric | Value |
|--------|-------|
| **Phases** | 2 |
| **Requirements** | 5 |
| **Estimated Timeline** | 1-2 days |

---

### Phase 6: GitHub Actions 多架构构建

**Goal:** 配置 tag 推送后自动构建 6 平台二进制并上传到 Releases

**Requirements:**
- CI/CD-01: Tag 推送后自动触发多架构构建
- CI/CD-02: 自动上传构建产物到 GitHub Releases
- SEC-02: 最小权限原则

**Success Criteria:**
1. 推送 v* tag 后自动触发 workflow
2. 生成 6 个平台的二进制文件
3. 所有二进制文件作为 release assets 上传成功
4. Release 描述包含自动生成的 changelog

**Plans:** 1 plan (COMPLETE)

Plans:
- [x] 06-01-PLAN.md — 优化 release.yml workflow 配置（权限精简、job 依赖修复、changelog 生成健壮）

**Wave Structure:**
- Wave 1: 06-01 (COMPLETE)

**Result:** Phase 6 COMPLETE - release.yml refactored to 2-job architecture with proper build/release separation

---

### Phase 7: 跨仓库部署到 db-skill

**Goal:** 配置 PAT 跨仓库推送，更新 db-skill 仓库的二进制文件

**Requirements:**
- CI/CD-03: 自动更新 db-skill 仓库的二进制文件
- SEC-01: 配置跨仓库访问 PAT

**Success Criteria:**
1. 创建 PAT 并添加到 db-cli 仓库 Secrets
2. workflow 成功检出 db-skill 仓库
3. 二进制文件复制到 `binaries/vX.Y.Z/` 目录
4. latest 副本和 VERSION 文件更新成功
5. commit 推送到 db-skill 仓库成功

**Tasks:**
1. 创建 Fine-grained PAT (Contents: R&W for db-skill)
2. 添加 `CROSS_REPO_PAT` 到 db-cli 仓库 Secrets
3. 在 release.yml 添加 deploy-to-db-skill 任务
4. 实现文件复制和版本管理逻辑
5. 端到端测试完整流程

---

## Requirements Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| CI/CD-01 | Phase 6 | Complete |
| CI/CD-02 | Phase 6 | Complete |
| CI/CD-03 | Phase 7 | Covered |
| SEC-01 | Phase 7 | Covered |
| SEC-02 | Phase 6 | Complete |

**Coverage:** 3/5 Phase 6 requirements complete (60%)

---

## Dependencies

```
Phase 6 → Phase 7
   ✓          ○
```

Phase 6 必须先完成，因为 Phase 7 依赖 Phase 6 构建的二进制文件。

---

## Next Milestone

**v2.0** — Planning required

Run `/gsd:new-milestone` to start next milestone cycle with:
1. Questioning — clarify goals and constraints
2. Research — investigate new databases (PostgreSQL, SQLite)
3. Requirements — define v2.0 scope
4. Roadmap — create phase structure

---

## Progress Summary

| Milestone | Phases | Status | Shipped |
|-----------|--------|--------|---------|
| v1.0 MVP | 1-5 | ✅ Complete | 2026-04-01 |
| v1.1 CI/CD | 6-7 | 1/2 Complete | Phase 6 shipped |

**v1.0 Delivery:**
- 22/22 requirements (100%)
- 5 phases, 17 plans
- 6-platform releases
- Claude Code Skill integration

---

*For full v1.0 archive, see `.planning/milestones/v1.0-ROADMAP.md`*
