# Cross-Repository Deployment Research for db-cli v1.1

**Date:** 2026-04-01
**Purpose:** Research best practices for deploying db-cli binaries across repositories after tag releases

---

## Executive Summary

For db-cli v1.1, the recommended approach is **Option 1: Direct Git Push with PAT** for updating the db-skill repository. This approach offers:
- Simplest implementation with minimal moving parts
- Direct control over file updates in the target repository
- No additional webhook or API configuration needed
- Well-documented pattern with many real-world examples

---

## Background

db-cli requires:
1. Build multi-architecture binaries on tag push (v*)
2. Upload binaries to current repository Releases
3. Update binaries in a separate `db-skill` repository

---

## Option 1: Direct Git Push with PAT (RECOMMENDED)

### Overview
Use a Personal Access Token (PAT) to authenticate and push directly to the target repository from the workflow.

### Required Secrets
| Secret | Description | How to Create |
|--------|-------------|---------------|
| `CROSS_REPO_PAT` | GitHub PAT with `repo` scope for target repository | Settings → Developer settings → Personal access tokens → Generate new token |

### Required Permissions in Workflow
```yaml
permissions:
  contents: write  # For creating releases in current repo
```

### Workflow Example
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build Multi-Arch Binaries
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: windows-latest
            goos: windows
            goarch: amd64
          - os: macos-latest
            goos: darwin
            goarch: arm64
          - os: ubuntu-latest
            goos: linux
            goarch: amd64

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Build binary
        env:
          GOOS: ${{ matrix.goos }}
          GOARCH: ${{ matrix.goarch }}
          CGO_ENABLED: 0
        run: |
          go build -ldflags="-s -w -X main.Version=${GITHUB_REF#refs/tags/}" \
            -o db-cli-${{ matrix.goos }}-${{ matrix.goarch }} ./cmd

      - name: Upload to Release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./db-cli-${{ matrix.goos }}-${{ matrix.goarch }}
          asset_name: db-cli-${{ matrix.goos }}-${{ matrix.goarch }}
          asset_content_type: application/octet-stream

      - name: Upload artifact for cross-repo deploy
        uses: actions/upload-artifact@v4
        with:
          name: binaries-${{ matrix.goos }}-${{ matrix.goarch }}
          path: ./db-cli-${{ matrix.goos }}-${{ matrix.goarch }}

  deploy-to-db-skill:
    name: Deploy to db-skill Repository
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: ./binaries

      - name: Checkout db-skill repository
        uses: actions/checkout@v4
        with:
          repository: xiaokexiang/db-skill
          token: ${{ secrets.CROSS_REPO_PAT }}
          ref: main

      - name: Update binaries in db-skill
        run: |
          # Create versioned directory
          VERSION=${GITHUB_REF#refs/tags/}
          mkdir -p "binaries/$VERSION"
          
          # Copy all downloaded binaries
          cp -r ../binaries/* "binaries/$VERSION/"
          
          # Update latest symlinks or copies
          cp "binaries/$VERSION"/* binaries/
          
          # Update version manifest
          echo "$VERSION" > binaries/VERSION

      - name: Commit and push to db-skill
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add binaries/
          git commit -m "chore: update db-cli binaries to ${{ github.ref_name }}"
          git push
        env:
          GITHUB_TOKEN: ${{ secrets.CROSS_REPO_PAT }}
```

### Pros
- **Simple**: Single workflow, straightforward logic
- **Direct**: No intermediate steps or API calls
- **Flexible**: Can update any files in target repo
- **Atomic**: Single commit contains all changes

### Cons
- **Security**: PAT has broad repository access (scope limitations apply)
- **Race conditions**: Concurrent pushes may conflict
- **No audit trail**: Changes appear as bot commits

---

## Option 2: repository_dispatch Event (ALTERNATIVE)

### Overview
Trigger a workflow in the target repository using GitHub's `repository_dispatch` event.

### Required Secrets
| Secret | Description |
|--------|-------------|
| `DB_SKILL_DISPATCH_TOKEN` | GitHub PAT with `repo` scope (or fine-grained token with actions:write) |

### Source Repository Workflow (db-cli)
```yaml
name: Trigger db-skill Update

on:
  release:
    types: [published]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger db-skill workflow
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token ${{ secrets.DB_SKILL_DISPATCH_TOKEN }}" \
            https://api.github.com/repos/xiaokexiang/db-skill/dispatches \
            -d '{
              "event_type": "update-binaries",
              "client_payload": {
                "version": "${{ github.ref_name }}",
                "release_url": "${{ github.event.release.html_url }}"
              }
            }'
```

### Target Repository Workflow (db-skill)
```yaml
name: Update db-cli Binaries

on:
  repository_dispatch:
    types: [update-binaries]

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download binaries from db-cli release
        run: |
          VERSION=${{ github.event.client_payload.version }}
          # Use GitHub CLI or API to download from release
          gh release download "$VERSION" --repo xiaokexiang/db-cli --dir binaries/$VERSION
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit and push
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add binaries/
          git commit -m "chore: update db-cli to ${{ github.event.client_payload.version }}"
          git push
```

### Pros
- **Decoupled**: Target repo controls its own update logic
- **Auditable**: Clear event trail in both repositories
- **Flexible payload**: Can pass arbitrary data
- **Better security**: Target repo uses its own GITHUB_TOKEN

### Cons
- **More complex**: Two workflows to maintain
- **Eventual consistency**: Slight delay between trigger and execution
- **API rate limits**: Dispatch calls count against rate limit

---

## Option 3: Release Assets Download (READ-ONLY TARGET)

### Overview
Target repository downloads binaries as release assets from source repository.

### Use Case
When target repository only needs to **read** binaries (not modify them).

### Target Repository Workflow
```yaml
name: Sync db-cli Binaries

on:
  schedule:
    - cron: '0 * * * *'  # Check hourly
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download latest release
        uses: robinraju/release-downloader@v1
        with:
          repository: xiaokexiang/db-cli
          latest: true
          out-file-path: binaries

      - name: Commit updates
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add binaries/
          git commit -m "chore: sync db-cli binaries"
          git push
```

### Pros
- **Pull-based**: Target controls when to update
- **No cross-repo secrets**: Uses public releases or GITHUB_TOKEN
- **Simple**: No dispatch configuration

### Cons
- **Not real-time**: Polling delay or manual trigger
- **Limited control**: Cannot push custom files, only download

---

## Option 4: GitHub CLI (gh) Dispatch

### Overview
Use `gh` CLI to trigger workflows in another repository.

### Prerequisites
- `gh` CLI installed in runner (pre-installed on GitHub-hosted runners)
- PAT with `repo` and `workflow` scopes

### Example
```yaml
- name: Trigger db-skill workflow using gh
  run: |
    gh workflow run update-binaries.yml \
      --repo xiaokexiang/db-skill \
      --field version=${{ github.ref_name }} \
      --field release_url=${{ github.event.release.html_url }}
  env:
    GH_TOKEN: ${{ secrets.DB_SKILL_DISPATCH_TOKEN }}
```

### Pros
- **Clean syntax**: More readable than curl
- **Built-in validation**: Better error messages
- **Field passing**: Easy payload construction

### Cons
- **Same as Option 2**: Just different implementation
- **Additional dependency**: Requires gh CLI (though usually available)

---

## Security Considerations

### PAT Scope Requirements
| Scope | Purpose |
|-------|---------|
| `repo` | Full control of private repositories (includes public_repo for public repos) |
| `workflow` | Update GitHub Actions workflows (if modifying workflows) |

### Fine-Grained Personal Access Tokens (Beta)
GitHub now offers fine-grained tokens with more specific permissions:
- Limit to specific repositories only
- Grant only `Contents: Read & Write` and `Actions: Read & Write`
- No broad `repo` scope needed

### Best Practices
1. **Least privilege**: Use fine-grained tokens when possible
2. **Repository-scoped**: Limit PAT to only the target repository
3. **Rotate regularly**: Update PATs periodically
4. **Use environments**: Consider GitHub Environments with protection rules

---

## Comparison Matrix

| Criteria | Direct Push | repository_dispatch | Release Download | gh Dispatch |
|----------|-------------|---------------------|------------------|-------------|
| **Complexity** | Low | Medium | Low | Low-Medium |
| **Real-time** | Yes | Yes | No (polling) | Yes |
| **Security** | PAT required | PAT + token isolation | Token-less | PAT required |
| **Flexibility** | High | High | Low | High |
| **Audit Trail** | Bot commits | Event log | Bot commits | Event log |
| **Race Conditions** | Possible | None | None | None |
| **Recommended For** | Simple syncs | Decoupled systems | Read-only sync | GitHub-native workflows |

---

## Recommendation for db-cli v1.1

### Primary: Direct Git Push with PAT

**Rationale:**
1. **Single organization**: Both db-cli and db-skill are under same user account
2. **Simple use case**: Just copying binaries and updating a manifest
3. **Minimal overhead**: One workflow to maintain
4. **Immediate execution**: No polling or event delay

### Implementation Checklist

- [ ] Create PAT with `repo` scope (or fine-grained token)
- [ ] Add `CROSS_REPO_PAT` secret to db-cli repository
- [ ] Implement build job with artifact upload
- [ ] Implement deploy job with cross-repo checkout
- [ ] Test with a draft release first
- [ ] Document the process in db-skill README

### Future Considerations

If db-skill grows to need more autonomy:
- Migrate to `repository_dispatch` for better decoupling
- Add webhook notifications for external systems
- Consider using GitHub Packages for binary distribution

---

## References

- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [repository_dispatch Event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token)
- [actions/checkout for cross-repo](https://github.com/actions/checkout#checkout-a-different-branch)
- [GitHub CLI workflow run](https://cli.github.com/manual/gh_workflow_run)

---

## Sources

- [GitHub Actions permissions documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
- [repository_dispatch event documentation](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
- [Cross-repository workflow examples](https://github.com/marketplace/actions/synced-files)
- [GitHub CLI workflow commands](https://cli.github.com/manual/gh_workflow_run)
