# PAT Configuration Guide for Cross-Repository Deploy

**Purpose:** Configure Personal Access Token (PAT) for deploying db-cli binaries to the db-skill repository

**Date Created:** 2026-04-01
**Related Plan:** 07-01 (Phase 07-db-skill, Plan 01)

---

## Overview

The `deploy-to-db-skill` job in `release.yml` requires a Personal Access Token to authenticate and push updates to the `xiaokexiang/db-skill` repository. This guide walks you through creating and configuring the PAT.

---

## Step 1: Create Fine-grained Personal Access Token

### Navigate to Token Settings

1. Go to GitHub Settings
2. Navigate to: **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
3. Click **"Generate new token"**

### Configure Token Settings

| Field | Value |
|-------|-------|
| **Token name** | `db-cli-cross-repo-deploy` |
| **Expiration** | 90 days (recommended) or Custom |
| **Description** | Cross-repository deploy token for db-cli → db-skill binary distribution |

### Repository Access

1. Select **"Only select repositories"**
2. Click the dropdown and select: **xiaokexiang/db-skill**
3. This limits the token's access to only the db-skill repository

### Permissions Configuration

Under **Repository permissions**, configure:

| Permission | Access Level | Why |
|------------|--------------|-----|
| **Contents** | **Read & Write** | Required to push binary files to the repository |
| **Actions** | Read (optional) | For viewing workflow runs in db-skill |

Click **"Generate token"** at the bottom of the page.

### Copy Token Value

**IMPORTANT:** Copy the token value immediately. You will not be able to see it again after navigating away.

The token will look like: `github_pat_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Step 2: Add Secret to db-cli Repository

### Navigate to Secrets Settings

1. Go to the db-cli repository: https://github.com/xiaokexiang/db-cli
2. Click **Settings** tab
3. Navigate to: **Secrets and variables → Actions**
4. Click **"New repository secret"**

### Create the Secret

| Field | Value |
|-------|-------|
| **Name** | `CROSS_REPO_PAT` |
| **Value** | [Paste the PAT value you copied] |

Click **"Add secret"**.

### Verify Secret Was Added

You should now see `CROSS_REPO_PAT` listed in the repository secrets table.

---

## Step 3: Verify PAT Permissions (Optional but Recommended)

### Test API Access

You can verify the PAT has correct permissions by running:

```bash
# Replace TOKEN with your actual PAT value
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/repos/xiaokexiang/db-skill
```

Expected response: JSON object with repository information (status 200).

### Test Git Clone with PAT

```bash
# Clone using the PAT as authentication
git clone https://TOKEN@github.com/xiaokexiang/db-skill.git /tmp/test-clone
```

If successful, the repository will be cloned to `/tmp/test-clone`.

---

## Security Best Practices

### Least Privilege Principle

- This PAT only grants access to `xiaokexiang/db-skill` repository
- Only `Contents: Read & Write` permission is granted
- No access to other repositories or account settings

### Token Rotation

- Set a reminder to rotate the PAT every 90 days
- GitHub will send expiration notifications if email is configured
- To rotate: create new token → update secret → delete old token

### Monitoring

- Review token usage at: https://github.com/settings/tokens
- Check db-skill repository audit log for push activity
- Monitor GitHub Actions workflow runs for any failures

---

## Troubleshooting

### Error: "Remote: Invalid username or password"

**Cause:** PAT has expired or was revoked

**Solution:**
1. Create a new PAT following Step 1
2. Update the `CROSS_REPO_PAT` secret with the new value
3. Re-run the workflow

### Error: "Resource not accessible by integration"

**Cause:** PAT doesn't have sufficient permissions

**Solution:**
1. Verify the token has **Contents: Read & Write** permission
2. Verify the token has access to the `xiaokexiang/db-skill` repository
3. Regenerate token if necessary

### Error: "Repository not found"

**Cause:** Token doesn't have access to the target repository

**Solution:**
1. Go to token settings and verify repository access includes `xiaokexiang/db-skill`
2. If using classic PAT, ensure `repo` scope is enabled

---

## Next Steps

After completing this setup:

1. The `deploy-to-db-skill` job will automatically run on the next tag release
2. Binaries will be pushed to `db-skill/scripts/` directory
3. The workflow uses the token via `${{ secrets.CROSS_REPO_PAT }}`

---

## References

- [GitHub Fine-grained PAT Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cross-Repository Deploy Research](./.planning/research/CROSS_REPO_DEPLOY.md)
