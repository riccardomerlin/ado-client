# Deploy to AWS App Runner using ECR
# This script creates an App Runner service with ECR container deployment

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1",
    [switch]$Setup
)

Write-Host "🚀 Deploying to AWS App Runner..." -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    Write-Host "💡 Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

aws sts get-caller-identity 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS credentials configured" -ForegroundColor Green

# Setup IAM roles if requested
if ($Setup) {
    Write-Host "⚙️  Setting up IAM roles for App Runner..." -ForegroundColor Yellow
      # Create App Runner access role for ECR
    $trustPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "build.apprunner.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
"@
    
    $trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8
      Write-Host "Creating App Runner service role..." -ForegroundColor Cyan
    aws iam create-role --role-name AppRunnerECRAccessRole --assume-role-policy-document file://trust-policy.json 2>$null
    aws iam attach-role-policy --role-name AppRunnerECRAccessRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
    
    Remove-Item "trust-policy.json" -Force
    Write-Host "✅ IAM roles configured" -ForegroundColor Green
}

# ECR deployment
Write-Host "📦 Setting up ECR deployment..." -ForegroundColor Yellow

$accountId = aws sts get-caller-identity --query Account --output text
$ecrRepo = "$accountId.dkr.ecr.$Region.amazonaws.com/$ServiceName"

Write-Host "Creating ECR repository..." -ForegroundColor Cyan
aws ecr create-repository --repository-name $ServiceName --region $Region 2>$null
Write-Host "Building and pushing Docker image..." -ForegroundColor Cyan
      # Check if Dockerfile exists
    if (!(Test-Path "Dockerfile")) {
        Write-Host "❌ Dockerfile not found. Please ensure Dockerfile exists in the current directory." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dockerfile found" -ForegroundColor Green
      # Check if WSL is available and Docker is running there
    Write-Host "Checking Docker availability..." -ForegroundColor Cyan
    wsl docker --version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker not available in WSL. Please ensure Docker is running in WSL." -ForegroundColor Red
        Write-Host "💡 Try: wsl docker --version" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Docker available in WSL" -ForegroundColor Green
    
    # Build and push using WSL
    Write-Host "Logging into ECR..." -ForegroundColor Cyan
    aws ecr get-login-password --region $Region | wsl docker login --username AWS --password-stdin $ecrRepo
    
    Write-Host "Building Docker image..." -ForegroundColor Cyan
    wsl docker build -t $ServiceName .
    
    Write-Host "Tagging image..." -ForegroundColor Cyan
    wsl docker tag $ServiceName`:latest $ecrRepo`:latest
    
    Write-Host "Pushing to ECR..." -ForegroundColor Cyan
    wsl docker push $ecrRepo`:latest
    
    $imageUri = "$ecrRepo`:latest"
Write-Host "✅ Image pushed to: $imageUri" -ForegroundColor Green

# Create App Runner service configuration
$serviceConfig = @"
{
    "ServiceName": "$ServiceName",
    "SourceConfiguration": {
"@

# Get the IAM role ARN for ECR access
$accountId = aws sts get-caller-identity --query Account --output text
$roleArn = "arn:aws:iam::${accountId}:role/AppRunnerECRAccessRole"

$serviceConfig += @"
        "ImageRepository": {
            "ImageIdentifier": "$imageUri",
            "ImageConfiguration": {
                "Port": "3000",
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production"
                }
            },
            "ImageRepositoryType": "ECR"
        },
        "AutoDeploymentsEnabled": false,
        "AuthenticationConfiguration": {
            "AccessRoleArn": "$roleArn"
        }
    },
    "InstanceConfiguration": {
        "Cpu": "0.25 vCPU",
        "Memory": "0.5 GB"
    }
}
"@

$serviceConfig | Out-File -FilePath "apprunner-config.json" -Encoding UTF8

# Create the service
Write-Host "🚀 Creating App Runner service..." -ForegroundColor Yellow
$result = aws apprunner create-service --cli-input-json file://apprunner-config.json --region $Region

if ($LASTEXITCODE -eq 0) {
    $serviceArn = ($result | ConvertFrom-Json).Service.ServiceArn
    Write-Host "✅ App Runner service created successfully!" -ForegroundColor Green
    Write-Host "Service ARN: $serviceArn" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "⏳ Service is being deployed. This may take 5-10 minutes..." -ForegroundColor Yellow
    Write-Host "🔍 You can check status with: aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor Cyan
    
    # Wait a bit and show initial status
    Start-Sleep -Seconds 30
    Write-Host "📊 Checking initial status..." -ForegroundColor Yellow
    $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query 'Service.Status' --output text
    Write-Host "Current status: $status" -ForegroundColor Cyan
    
} else {
    Write-Host "❌ Failed to create App Runner service" -ForegroundColor Red
    Write-Host "💡 Check your permissions and try again" -ForegroundColor Yellow
}

# Cleanup temp files
Remove-Item "apprunner-config.json" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in the App Runner console" -ForegroundColor White
Write-Host "2. Monitor deployment progress in AWS Console" -ForegroundColor White
Write-Host "3. Once running, you'll get a public URL" -ForegroundColor White
Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Cyan
Write-Host "   .\deploy-apprunner.ps1                    # Deploy using ECR" -ForegroundColor White
Write-Host "   .\deploy-apprunner.ps1 -Setup             # Setup IAM roles first" -ForegroundColor White
Write-Host "   aws apprunner list-services --region $Region" -ForegroundColor White
Write-Host "   aws apprunner describe-service --service-arn <arn> --region $Region" -ForegroundColor White
Write-Host "   aws apprunner delete-service --service-arn <arn> --region $Region" -ForegroundColor White
