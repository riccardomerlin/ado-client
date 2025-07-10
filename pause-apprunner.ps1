# Pause an AWS App Runner Service
# This script finds and pauses a running App Runner service

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1",
    [switch]$WaitForPaused
)

Write-Host "⏸️  Pausing App Runner Service..." -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS CLI available" -ForegroundColor Green

aws sts get-caller-identity 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS credentials not configured" -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS credentials configured" -ForegroundColor Green

# Find the service
Write-Host "🔍 Finding App Runner service: $ServiceName" -ForegroundColor Cyan
$services = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$ServiceName']" --output json | ConvertFrom-Json

if (-not $services -or $services.Count -eq 0) {
    Write-Host "❌ No service found with name: $ServiceName" -ForegroundColor Red
    Write-Host "💡 Available services:" -ForegroundColor Yellow
    aws apprunner list-services --region $Region --query "ServiceSummaryList[].ServiceName" --output table
    exit 1
}

$service = $services[0]
$serviceArn = $service.ServiceArn
$currentStatus = $service.Status

Write-Host "✅ Found service:" -ForegroundColor Green
Write-Host "   ARN: $serviceArn" -ForegroundColor Gray
Write-Host "   Current Status: $currentStatus" -ForegroundColor Gray
Write-Host ""

# Check current status
switch ($currentStatus) {
    "PAUSED" {
        Write-Host "ℹ️  Service is already paused!" -ForegroundColor Blue
        Write-Host "💡 Use .\restart-apprunner.ps1 to resume the service" -ForegroundColor Yellow
        exit 0
    }
    "RUNNING" {
        Write-Host "✅ Service is running and ready to pause" -ForegroundColor Green
    }
    "OPERATION_IN_PROGRESS" {
        Write-Host "⏳ Service operation in progress. Waiting..." -ForegroundColor Yellow
        do {
            Start-Sleep -Seconds 10
            $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
            Write-Host "   Status: $status" -ForegroundColor Gray
        } while ($status -eq "OPERATION_IN_PROGRESS")
        
        if ($status -eq "PAUSED") {
            Write-Host "ℹ️  Service is now paused!" -ForegroundColor Blue
            exit 0
        } elseif ($status -ne "RUNNING") {
            Write-Host "❌ Service is not in a running state. Current status: $status" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ Service is now running and ready to pause" -ForegroundColor Green
    }
    default {
        Write-Host "❌ Service is in an unexpected state: $currentStatus" -ForegroundColor Red
        Write-Host "💡 Expected states: RUNNING, PAUSED, or OPERATION_IN_PROGRESS" -ForegroundColor Yellow
        Write-Host "💡 Current state '$currentStatus' cannot be paused" -ForegroundColor Yellow
        exit 1
    }
}

# Show cost savings information
Write-Host "💰 Cost Information:" -ForegroundColor Cyan
Write-Host "   • Pausing stops compute charges while preserving your configuration" -ForegroundColor Gray
Write-Host "   • You'll only pay for container image storage in ECR" -ForegroundColor Gray
Write-Host "   • Resume anytime with .\restart-apprunner.ps1" -ForegroundColor Gray
Write-Host ""

# Confirm pause operation
$response = Read-Host "Are you sure you want to pause the service? (y/N)"
if ($response -notmatch "^[Yy]") {
    Write-Host "🚫 Operation cancelled" -ForegroundColor Yellow
    exit 0
}

# Pause the service
Write-Host ""
Write-Host "⏸️  Pausing App Runner service..." -ForegroundColor Yellow
aws apprunner pause-service --service-arn $serviceArn --region $Region | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to pause service" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pause command sent successfully!" -ForegroundColor Green

# Wait for service to be paused (if requested or by default)
if ($WaitForPaused -or !$PSBoundParameters.ContainsKey('WaitForPaused')) {
    Write-Host ""
    Write-Host "⏳ Waiting for service to be paused..." -ForegroundColor Yellow
    Write-Host "   This usually takes 1-2 minutes..." -ForegroundColor Gray
    
    $startTime = Get-Date
    do {
        Start-Sleep -Seconds 10
        $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
        Write-Host "   Status: $status (${elapsed}m elapsed)" -ForegroundColor Gray
        
        if ($elapsed -gt 5) {
            Write-Host "⚠️  Operation is taking longer than expected (${elapsed} minutes)" -ForegroundColor Yellow
            $continue = Read-Host "Continue waiting? (Y/n)"
            if ($continue -match "^[Nn]") {
                break
            }
        }
    } while ($status -eq "OPERATION_IN_PROGRESS")
    
    Write-Host ""
    if ($status -eq "PAUSED") {
        Write-Host "🎉 Service is now paused!" -ForegroundColor Green
        Write-Host ""
        Write-Host "💡 Next steps:" -ForegroundColor Cyan
        Write-Host "   • Your service is now paused and not incurring compute charges" -ForegroundColor Gray
        Write-Host "   • To resume: .\restart-apprunner.ps1" -ForegroundColor Gray
        Write-Host "   • To check status: aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor Gray
    } else {
        Write-Host "❌ Service failed to pause. Final status: $status" -ForegroundColor Red
        Write-Host "💡 Check the App Runner console for more details" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "💡 Use -WaitForPaused to monitor the pause process" -ForegroundColor Yellow
    Write-Host "💡 Check service status with: aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Script completed!" -ForegroundColor Green
