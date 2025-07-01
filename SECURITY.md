# Secure Environment Variable Management for AWS App Runner

## 🔐 Security Best Practices (Updated July 2025)

## Environment Variable Management
- All sensitive and required environment variables are stored in AWS SSM Parameter Store under `/apprunner/<service>/<VAR_NAME>`.
- Use `setup-secure-env-simple.ps1` to create/update these parameters. This script is copy-paste friendly and loads defaults from `.env`.
- Secrets (like `ADO_CLIENT_PAT`) are stored as `SecureString` and never hardcoded or committed.

## Deployment
- Only use `deploy-apprunner-with-env.ps1` and `update-apprunner-env.ps1` for App Runner deployments.
- No secrets or sensitive data are present in any YAML, Dockerfile, or codebase files.
- All legacy scripts that handled secrets insecurely have been removed.

## Auditing
- Review SSM Parameter Store for all environment variables.
- Rotate secrets (like PAT) regularly using the setup script.

## Summary
This project follows best practices for secret management and secure deployment on AWS. All legacy, insecure, or redundant scripts have been removed.

## 🔧 **Required Environment Variables**

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `NODE_ENV` | String | Runtime environment | `production` |
| `ORG_URL` | String | Azure DevOps org URL | `https://dev.azure.com/myorg` |
| `PROJECT_NAME` | String | Azure DevOps project | `MyProject` |
| `TEAM_ID` | String | Team GUID | `12345678-1234-1234-1234-123456789012` |
| `API_VERSION` | String | API version | `7.1` |
| `PORT` | String | Server port | `3000` |
| `DEFAULT_RELEASE` | String | Release version | `25R3` |
| `DEFAULT_AREA_PATH` | String | Area path | `MyProject\\MyTeam` |
| `RELEASE_FIELD_NAME` | String | Custom field | `Custom.Release` |
| `DEFAULT_RELATIONSHIP_STRATEGY` | String | Strategy | `hierarchy-with-related` |
| `ADO_CLIENT_PAT` | **SecureString** | **Personal Access Token** | `ghp_xxxxxxxxxxxx` |

## 🚀 **Deployment Workflow**

### For New Deployments:
1. Deploy without sensitive variables:
   ```powershell
   .\deploy-apprunner.ps1
   ```

2. Set up secure parameters:
   ```powershell
   .\setup-secure-env.ps1
   ```

3. Update service with environment variables:
   ```powershell
   .\update-apprunner-env.ps1
   ```

### For Updates:
1. Update code and push image:
   ```powershell
   .\update-apprunner.ps1
   ```

2. Update environment variables if needed:
   ```powershell
   .\update-apprunner-env.ps1
   ```

## 🔍 **Verification**

Check if your service has the required environment variables:
```bash
aws apprunner describe-service \
  --service-arn "your-service-arn" \
  --query 'Service.SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentVariables'
```

## 🎯 **Security Benefits**

- ✅ **Encrypted at Rest**: SSM Parameter Store encrypts sensitive data
- ✅ **Access Control**: IAM policies control who can read parameters
- ✅ **Audit Trail**: CloudTrail logs parameter access
- ✅ **Version History**: Parameter Store maintains version history
- ✅ **No Code Exposure**: Secrets never appear in source code or logs
- ✅ **Easy Rotation**: Update parameters without touching code

## 🚨 **Security Reminders**

- Never commit PATs or secrets to version control
- Use `SecureString` type for sensitive parameters
- Regularly rotate Personal Access Tokens
- Use least-privilege IAM roles
- Monitor parameter access via CloudTrail
- Use different parameters for different environments (dev/staging/prod)
