# Restart (Resume) a Paused AWS App Runner Service
# This script finds and resumes a paused App Runner service

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1",
    [switch]$WaitForRunning
)

Write-Host "🔄 Restarting App Runner Service..." -ForegroundColor Green
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
    "RUNNING" {
        Write-Host "ℹ️  Service is already running!" -ForegroundColor Blue
        Write-Host "💡 If you want to restart a running service, you need to pause it first, then resume it." -ForegroundColor Yellow
        
        $response = Read-Host "Do you want to pause and then resume the service? (y/N)"
        if ($response -match "^[Yy]") {
            Write-Host "⏸️  Pausing service first..." -ForegroundColor Yellow
            aws apprunner pause-service --service-arn $serviceArn --region $Region | Out-Null
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Failed to pause service" -ForegroundColor Red
                exit 1
            }
            
            # Wait for service to be paused
            Write-Host "⏳ Waiting for service to pause..." -ForegroundColor Yellow
            do {
                Start-Sleep -Seconds 10
                $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
                Write-Host "   Status: $status" -ForegroundColor Gray
            } while ($status -eq "OPERATION_IN_PROGRESS")
            
            if ($status -ne "PAUSED") {
                Write-Host "❌ Service failed to pause. Current status: $status" -ForegroundColor Red
                exit 1
            }
            
            Write-Host "✅ Service paused successfully" -ForegroundColor Green
        } else {
            Write-Host "🚫 Operation cancelled" -ForegroundColor Yellow
            exit 0
        }
    }
    "PAUSED" {
        Write-Host "✅ Service is paused and ready to resume" -ForegroundColor Green
    }
    "OPERATION_IN_PROGRESS" {
        Write-Host "⏳ Service operation in progress. Waiting..." -ForegroundColor Yellow
        do {
            Start-Sleep -Seconds 10
            $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
            Write-Host "   Status: $status" -ForegroundColor Gray
        } while ($status -eq "OPERATION_IN_PROGRESS")
        
        if ($status -ne "PAUSED") {
            Write-Host "❌ Service is not in a paused state. Current status: $status" -ForegroundColor Red
            exit 1
        }
    }
    default {
        Write-Host "❌ Service is in an unexpected state: $currentStatus" -ForegroundColor Red
        Write-Host "💡 Expected states: RUNNING, PAUSED, or OPERATION_IN_PROGRESS" -ForegroundColor Yellow
        exit 1
    }
}

# Resume the service
Write-Host ""
Write-Host "▶️  Resuming App Runner service..." -ForegroundColor Green
aws apprunner resume-service --service-arn $serviceArn --region $Region | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to resume service" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Resume command sent successfully!" -ForegroundColor Green

# Wait for service to be running (if requested)
if ($WaitForRunning -or !$PSBoundParameters.ContainsKey('WaitForRunning')) {
    Write-Host ""
    Write-Host "⏳ Waiting for service to be running..." -ForegroundColor Yellow
    Write-Host "   This may take a few minutes..." -ForegroundColor Gray
    
    $startTime = Get-Date
    do {
        Start-Sleep -Seconds 15
        $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.Status" --output text
        $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
        Write-Host "   Status: $status (${elapsed}m elapsed)" -ForegroundColor Gray
        
        if ($elapsed -gt 10) {
            Write-Host "⚠️  Operation is taking longer than expected (${elapsed} minutes)" -ForegroundColor Yellow
            $continue = Read-Host "Continue waiting? (Y/n)"
            if ($continue -match "^[Nn]") {
                break
            }
        }
    } while ($status -eq "OPERATION_IN_PROGRESS")
    
    Write-Host ""
    if ($status -eq "RUNNING") {
        Write-Host "🎉 Service is now running!" -ForegroundColor Green
        
        # Get service URL
        $serviceUrl = aws apprunner describe-service --service-arn $serviceArn --region $Region --query "Service.ServiceUrl" --output text
        Write-Host "🌐 Service URL: https://$serviceUrl" -ForegroundColor Cyan
        
        # Test the service
        Write-Host ""
        Write-Host "🧪 Testing service health..." -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "https://$serviceUrl" -TimeoutSec 30 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Service is responding correctly!" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Service responded with status code: $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  Unable to test service: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "💡 You may need to wait a bit longer for the service to fully initialize" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Service failed to start. Final status: $status" -ForegroundColor Red
        Write-Host "💡 Check the App Runner console for more details" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "💡 Use -WaitForRunning to monitor the startup process" -ForegroundColor Yellow
    Write-Host "💡 Check service status with: aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Script completed!" -ForegroundColor Green
