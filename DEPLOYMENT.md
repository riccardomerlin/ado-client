# Deployment Guide (Updated July 2025)

## Overview
This project is now deployed to AWS App Runner using secure environment variables from AWS SSM Parameter Store and container images from ECR. All legacy scripts and insecure workflows have been removed.

## Required Scripts
- `setup-secure-env-simple.ps1`: Sets up all required environment variables in SSM Parameter Store. Copy-paste friendly, loads defaults from `.env`.
- `deploy-apprunner-with-env.ps1`: Builds, pushes, and deploys the container to App Runner, injecting all environment variables from SSM at creation.
- `update-apprunner-env.ps1`: Updates environment variables on an existing App Runner service from SSM.

## Secure Environment Variables
All required variables (including secrets like PAT) are managed in SSM Parameter Store. See `SECURITY.md` for details.

## Deployment Steps
1. Run `setup-secure-env-simple.ps1` to set up SSM parameters.
2. Run `deploy-apprunner-with-env.ps1` to deploy the service (or update with `update-apprunner-env.ps1`).
3. Monitor deployment with AWS CLI or console.
4. Access your app at the App Runner public URL.

## Deprecated/Removed Scripts
- `setup-secure-env.ps1` (replaced by `setup-secure-env-simple.ps1`)
- `deploy-apprunner.ps1` (replaced by `deploy-apprunner-with-env.ps1`)
- `setup-apprunner-env.ps1` (no longer needed)
- `update-apprunner.ps1` (replaced by `update-apprunner-env.ps1`)

## Useful AWS CLI Commands
- `aws apprunner list-services --region <region>`
- `aws apprunner describe-service --service-arn <arn> --region <region>`

---

For more details, see `SECURITY.md` and the comments in each script.
