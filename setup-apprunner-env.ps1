# Setup Environment Variables for AWS App Runner
# This script helps configure environment variables for your App Runner service

param(
    [string]$ServiceArn = "",
    [string]$Region = "eu-west-1"
)

Write-Host "⚙️  Setting up App Runner Environment Variables..." -ForegroundColor Green
Write-Host ""

if (-not $ServiceArn) {
    Write-Host "📋 Available App Runner services:" -ForegroundColor Yellow
    aws apprunner list-services --region $Region --query 'ServiceSummaryList[].{Name:ServiceName,Arn:ServiceArn,Status:Status}' --output table
    Write-Host ""
    $ServiceArn = Read-Host "Enter the Service ARN"
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your configuration first." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Reading environment variables from .env file..." -ForegroundColor Yellow

# Parse .env file
$envVars = @{}
$envContent = Get-Content ".env"

foreach ($line in $envContent) {
    if ($line -match "^([^#][^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$name] = $value
    }
}

Write-Host "Found $($envVars.Count) environment variables:" -ForegroundColor Cyan
foreach ($key in $envVars.Keys) {
    if ($key -eq "ADO_CLIENT_PAT") {
        Write-Host "  $key = [HIDDEN]" -ForegroundColor White
    } else {
        Write-Host "  $key = $($envVars[$key])" -ForegroundColor White
    }
}

Write-Host ""
$confirm = Read-Host "Do you want to update the App Runner service with these environment variables? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host ""
    Write-Host "🔧 Updating App Runner service configuration..." -ForegroundColor Yellow
    
    # Get current service configuration
    $currentConfig = aws apprunner describe-service --service-arn $ServiceArn --region $Region | ConvertFrom-Json
    
    # Build environment variables object for App Runner
    $envVarsForAppRunner = @{}
    foreach ($key in $envVars.Keys) {
        $envVarsForAppRunner[$key] = $envVars[$key]
    }
    
    # Add NODE_ENV
    $envVarsForAppRunner["NODE_ENV"] = "production"
    
    # Create update configuration
    $updateConfig = @{
        ServiceArn = $ServiceArn
        SourceConfiguration = $currentConfig.Service.SourceConfiguration
        InstanceConfiguration = @{
            Cpu = $currentConfig.Service.InstanceConfiguration.Cpu
            Memory = $currentConfig.Service.InstanceConfiguration.Memory
            InstanceRoleArn = $currentConfig.Service.InstanceConfiguration.InstanceRoleArn
        }
    }
    
    # Update image configuration with environment variables
    if ($currentConfig.Service.SourceConfiguration.ImageRepository) {
        $updateConfig.SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentVariables = $envVarsForAppRunner
    } else {
        Write-Host "⚠️  This service uses source code. Environment variables should be set via apprunner.yaml" -ForegroundColor Yellow
        Write-Host "💡 Adding environment variables to apprunner.yaml file..." -ForegroundColor Cyan
        
        # Update apprunner.yaml with environment variables
        $appRunnerConfig = Get-Content "apprunner.yaml" -Raw
        $envSection = "`n  env:`n"
        $envSection += "    - name: NODE_ENV`n      value: production`n"
        
        foreach ($key in $envVars.Keys) {
            $envSection += "    - name: $key`n      value: `"$($envVars[$key])`"`n"
        }
        
        if ($appRunnerConfig -match "env:") {
            # Replace existing env section
            $appRunnerConfig = $appRunnerConfig -replace "env:.*", $envSection.Trim()
        } else {
            # Add env section
            $appRunnerConfig += $envSection
        }
        
        $appRunnerConfig | Out-File -FilePath "apprunner.yaml" -Encoding UTF8
        Write-Host "✅ Updated apprunner.yaml with environment variables" -ForegroundColor Green
        Write-Host "💡 Commit and push changes to trigger a new deployment" -ForegroundColor Yellow
        return
    }
    
    # Update the service (for ECR deployments)
    $updateConfigJson = $updateConfig | ConvertTo-Json -Depth 10
    $updateConfigJson | Out-File -FilePath "update-config.json" -Encoding UTF8
    
    Write-Host "Updating App Runner service..." -ForegroundColor Cyan
    aws apprunner update-service --cli-input-json file://update-config.json --region $Region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service updated successfully!" -ForegroundColor Green
        Write-Host "🔄 Service is being redeployed with new environment variables..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to update service" -ForegroundColor Red
    }
    
    Remove-Item "update-config.json" -Force -ErrorAction SilentlyContinue
    
} else {
    Write-Host "❌ Update cancelled" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Cyan
Write-Host "   aws apprunner describe-service --service-arn $ServiceArn --region $Region" -ForegroundColor White
Write-Host "   aws apprunner start-deployment --service-arn $ServiceArn --region $Region" -ForegroundColor White
