# Deploy to AWS Elastic Beanstalk without S3 permissions
# This creates the application and lets you upload via the console

param(
    [string]$AppName = "ado-client",
    [string]$Environment = "ado-client-env", 
    [string]$Region = "eu-west-1"
)

Write-Host "🚀 Deploying to AWS Elastic Beanstalk (No S3 method)..." -ForegroundColor Green

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

aws sts get-caller-identity 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS credentials configured" -ForegroundColor Green

# Step 1: Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow
$exclude = @("node_modules", ".git", "*.zip", "deploy-*.ps1")
$files = Get-ChildItem -Recurse | Where-Object { 
    $path = $_.FullName
    $shouldExclude = $false
    foreach ($pattern in $exclude) {
        if ($path -like "*$pattern*") {
            $shouldExclude = $true
            break
        }
    }
    -not $shouldExclude
}

if ($files.Count -eq 0) {
    Write-Host "❌ No files found to package" -ForegroundColor Red
    exit 1
}

$zipName = "$AppName-deploy.zip"
Compress-Archive -Path $files -DestinationPath $zipName -Force
Write-Host "✅ Created $zipName with $($files.Count) files" -ForegroundColor Green

# Step 2: Create application if it doesn't exist
Write-Host "🏗️  Setting up Beanstalk application..." -ForegroundColor Yellow
$appCheck = aws elasticbeanstalk describe-applications --application-names $AppName --region $Region | ConvertFrom-Json
if ($appCheck.Applications.Count -gt 0) {
    Write-Host "✅ Application '$AppName' already exists" -ForegroundColor Green
} else {
    Write-Host "Creating application '$AppName'..." -ForegroundColor Yellow
    aws elasticbeanstalk create-application --application-name $AppName --description "ADO Client Application" --region $Region
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create application" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Application '$AppName' created successfully" -ForegroundColor Green
}

# Step 3: Create environment directly using sample application (no upload needed)
Write-Host "🌍 Setting up environment..." -ForegroundColor Yellow
$envResult = aws elasticbeanstalk describe-environments --environment-names $Environment --region $Region 2>$null
if ($LASTEXITCODE -eq 0) {
    $envData = $envResult | ConvertFrom-Json
    if ($envData.Environments.Count -gt 0) {
        $envStatus = $envData.Environments[0].Status
        $envHealth = $envData.Environments[0].Health
        
        if ($envStatus -eq "Terminated") {
            Write-Host "⚠️  Environment '$Environment' exists but is terminated. Creating new environment..." -ForegroundColor Yellow
        } elseif ($envHealth -eq "Grey" -and ($envData.Environments[0].HealthStatus -eq "No Data" -or $envData.Environments[0].HealthStatus -eq "Unknown")) {
            Write-Host "⚠️  Environment '$Environment' has CloudFormation issues (Status: $envStatus, Health: $envHealth)" -ForegroundColor Yellow
            Write-Host "🔄 Terminating corrupted environment and recreating..." -ForegroundColor Yellow
            
            # Terminate the corrupted environment
            aws elasticbeanstalk terminate-environment --environment-name $Environment --region $Region
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Failed to terminate environment" -ForegroundColor Red
                exit 1
            }
            
            Write-Host "⏳ Waiting for environment to terminate (this may take a few minutes)..." -ForegroundColor Yellow
            do {
                Start-Sleep -Seconds 30
                $termResult = aws elasticbeanstalk describe-environments --environment-names $Environment --region $Region 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $termData = $termResult | ConvertFrom-Json
                    if ($termData.Environments.Count -gt 0) {
                        $termStatus = $termData.Environments[0].Status
                        Write-Host "  Current status: $termStatus" -ForegroundColor Cyan
                    }
                } else {
                    Write-Host "  Environment no longer exists" -ForegroundColor Green
                    break
                }
            } while ($termStatus -ne "Terminated")
            
            Write-Host "✅ Environment terminated. Creating new environment..." -ForegroundColor Green
        } else {
            Write-Host "✅ Environment '$Environment' already exists (Status: $envStatus, Health: $envHealth)" -ForegroundColor Green
            Write-Host "📝 To update with your code, use the AWS Console to upload $zipName" -ForegroundColor Yellow
            # Skip creation since environment exists and is healthy
            $skipCreation = $true
        }
    }
}

if (-not $skipCreation) {
    Write-Host "Creating environment '$Environment' with ultra-minimal configuration..." -ForegroundColor Yellow
    aws elasticbeanstalk create-environment `
        --application-name $AppName `
        --environment-name $Environment `
        --solution-stack-name "64bit Amazon Linux 2023 v6.6.0 running Node.js 22" `
        --option-settings `
            Namespace=aws:autoscaling:launchconfiguration,OptionName=IamInstanceProfile,Value=aws-elasticbeanstalk-ec2-role `
            Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=SingleInstance `
            Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=t3.micro `
            Namespace=aws:elasticbeanstalk:healthreporting:system,OptionName=SystemType,Value=basic `
        --region $Region
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create environment" -ForegroundColor Red
        Write-Host "💡 If this fails due to missing IAM role, you may need to:" -ForegroundColor Yellow
        Write-Host "   1. Go to AWS Console > IAM > Roles" -ForegroundColor White  
        Write-Host "   2. Create 'aws-elasticbeanstalk-ec2-role' if it doesn't exist" -ForegroundColor White
        Write-Host "   3. Or use the AWS Console to create the environment which auto-creates roles" -ForegroundColor White
        exit 1
    }
    Write-Host "✅ Environment '$Environment' creation started successfully" -ForegroundColor Green
    Write-Host "⏳ Environment is being created. This will take 3-7 minutes..." -ForegroundColor Yellow
    Write-Host "📝 Configuration: Single t3.micro instance, no EIP, basic health (ultra-minimal)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Deployment Summary:" -ForegroundColor Cyan
Write-Host "✅ Application: $AppName" -ForegroundColor Green
Write-Host "✅ Environment: $Environment" -ForegroundColor Green
Write-Host "✅ Deployment package: $zipName" -ForegroundColor Green
Write-Host ""
Write-Host "📤 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait for environment to finish creating (5-10 minutes)" -ForegroundColor White
Write-Host "2. Go to: https://console.aws.amazon.com/elasticbeanstalk/home?region=$Region" -ForegroundColor White
Write-Host "3. Click on '$Environment' environment" -ForegroundColor White
Write-Host "4. Click 'Upload and Deploy'" -ForegroundColor White
Write-Host "5. Select file: $zipName" -ForegroundColor White
Write-Host "6. Click 'Deploy'" -ForegroundColor White
Write-Host ""

# Check environment status
Write-Host "🔍 Checking environment status..." -ForegroundColor Yellow
$envStatus = aws elasticbeanstalk describe-environments --environment-names $Environment --region $Region --query 'Environments[0].Status' --output text 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Environment Status: $envStatus" -ForegroundColor Cyan
    if ($envStatus -eq "Ready") {
        $envUrl = aws elasticbeanstalk describe-environments --environment-names $Environment --region $Region --query 'Environments[0].CNAME' --output text
        Write-Host "🌐 Environment URL: http://$envUrl" -ForegroundColor Green
    }
} 

# Offer to open console
$openConsole = Read-Host "Do you want to open the AWS Console now? (y/n)"
if ($openConsole -eq 'y' -or $openConsole -eq 'Y') {
    Start-Process "https://console.aws.amazon.com/elasticbeanstalk/home?region=$Region"
}
