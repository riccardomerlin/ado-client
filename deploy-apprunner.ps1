# Deploy to AWS App Runner
# This script creates an App Runner service with minimal configuration

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1",
    [string]$GitHubRepo = "",
    [switch]$UseECR,
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
    
    # Create App Runner service role
    $trustPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "apprunner.amazonaws.com"
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

if ($UseECR) {
    # ECR deployment path
    Write-Host "📦 Setting up ECR deployment..." -ForegroundColor Yellow
    
    $accountId = aws sts get-caller-identity --query Account --output text
    $ecrRepo = "$accountId.dkr.ecr.$Region.amazonaws.com/$ServiceName"
    
    Write-Host "Creating ECR repository..." -ForegroundColor Cyan
    aws ecr create-repository --repository-name $ServiceName --region $Region 2>$null
    
    Write-Host "Building and pushing Docker image..." -ForegroundColor Cyan
    
    # Create optimized Dockerfile
    $dockerfileContent = @"
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 7010
CMD ["npm", "start"]
"@
    $dockerfileContent | Out-File -FilePath "Dockerfile" -Encoding UTF8
    
    # Build and push
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrRepo
    docker build -t $ServiceName .
    docker tag $ServiceName`:latest $ecrRepo`:latest
    docker push $ecrRepo`:latest
    
    $imageUri = "$ecrRepo`:latest"
    Write-Host "✅ Image pushed to: $imageUri" -ForegroundColor Green
    
} else {
    # GitHub source deployment (simpler)
    if (-not $GitHubRepo) {
        Write-Host "❌ GitHub repository URL required for source deployment" -ForegroundColor Red
        Write-Host "💡 Example: https://github.com/username/ado-client" -ForegroundColor Yellow
        Write-Host "💡 Or use -UseECR for container deployment" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "📂 Setting up GitHub source deployment..." -ForegroundColor Yellow
    Write-Host "Repository: $GitHubRepo" -ForegroundColor Cyan
}

# Create App Runner service configuration
$serviceConfig = @"
{
    "ServiceName": "$ServiceName",
    "SourceConfiguration": {
"@

if ($UseECR) {
    $serviceConfig += @"
        "ImageRepository": {
            "ImageIdentifier": "$imageUri",
            "ImageConfiguration": {
                "Port": "7010",
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production"
                }
            },
            "ImageRepositoryType": "ECR"
        },
        "AutoDeploymentsEnabled": false
"@
} else {
    $serviceConfig += @"
        "CodeRepository": {
            "RepositoryUrl": "$GitHubRepo",
            "SourceCodeVersion": {
                "Type": "BRANCH",
                "Value": "main"
            },
            "CodeConfiguration": {
                "ConfigurationSource": "CONFIGURATION_FILE"
            }
        },
        "AutoDeploymentsEnabled": true
"@
}

$serviceConfig += @"
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
if ($UseECR) {
    Remove-Item "Dockerfile" -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Set environment variables in the App Runner console" -ForegroundColor White
Write-Host "2. Monitor deployment progress in AWS Console" -ForegroundColor White
Write-Host "3. Once running, you'll get a public URL" -ForegroundColor White
Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Cyan
Write-Host "   aws apprunner list-services --region $Region" -ForegroundColor White
Write-Host "   aws apprunner describe-service --service-arn <arn> --region $Region" -ForegroundColor White
Write-Host "   aws apprunner delete-service --service-arn <arn> --region $Region" -ForegroundColor White
