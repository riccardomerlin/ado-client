# Update App Runner Environment Variables from SSM Parameter Store
# This script updates the App Runner service with secure environment variables

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1"
)

Write-Host "🔧 Updating App Runner environment variables..." -ForegroundColor Green

# Get the service ARN
Write-Host "Finding App Runner service..." -ForegroundColor Cyan
$services = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$ServiceName'].ServiceArn" --output text

if (-not $services) {
    Write-Host "❌ No service found with name: $ServiceName" -ForegroundColor Red
    exit 1
}

$serviceArn = $services
Write-Host "✅ Found service: $serviceArn" -ForegroundColor Green

# Function to get parameter value
function Get-ParameterValue {
    param($ParameterName)
    try {
        $result = aws ssm get-parameter --name "/apprunner/$ServiceName/$ParameterName" --with-decryption --region $Region --query "Parameter.Value" --output text 2>$null
        if ($LASTEXITCODE -eq 0 -and $result -ne "None") {
            return $result
        }
    } catch {
        Write-Host "⚠️  Parameter not found: $ParameterName" -ForegroundColor Yellow
    }
    return $null
}

# Build environment variables array
$envVars = @{
    "NODE_ENV" = "production"
}

# Add parameters from SSM if they exist
$parameters = @(
    "ORG_URL",
    "PROJECT_NAME", 
    "TEAM_ID",
    "API_VERSION",
    "PORT",
    "DEFAULT_RELEASE",
    "DEFAULT_AREA_PATH",
    "RELEASE_FIELD_NAME",
    "DEFAULT_RELATIONSHIP_STRATEGY",
    "ADO_CLIENT_PAT"
)

foreach ($param in $parameters) {
    $value = Get-ParameterValue $param
    if ($value) {
        $envVars[$param] = $value
        Write-Host "✅ Found parameter: $param" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Missing parameter: $param" -ForegroundColor Yellow
    }
}

# Build environment variables array
$envVars = @{
    "NODE_ENV" = "production"
}

Write-Host ""
Write-Host "🚀 Updating App Runner service configuration..." -ForegroundColor Cyan

# Get current service configuration
Write-Host "Getting current service configuration..." -ForegroundColor Yellow
$currentConfig = aws apprunner describe-service --service-arn $serviceArn --region $Region | ConvertFrom-Json

if (-not $currentConfig) {
    Write-Host "❌ Failed to get current service configuration" -ForegroundColor Red
    exit 1
}

# Convert environment variables to the correct format (dict instead of list)
$envVarsDict = @{}
foreach ($key in $envVars.Keys) {
    $envVarsDict[$key] = $envVars[$key]
}

# Create the update configuration with all required fields
$updateConfig = @{
    ImageRepository = @{
        ImageIdentifier = $currentConfig.Service.SourceConfiguration.ImageRepository.ImageIdentifier
        ImageRepositoryType = $currentConfig.Service.SourceConfiguration.ImageRepository.ImageRepositoryType
        ImageConfiguration = @{
            RuntimeEnvironmentVariables = $envVarsDict
            Port = "3000"
        }
    }
    AutoDeploymentsEnabled = $currentConfig.Service.SourceConfiguration.AutoDeploymentsEnabled
    AuthenticationConfiguration = $currentConfig.Service.SourceConfiguration.AuthenticationConfiguration
}

# Convert to JSON and save to temp file
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$updateConfig | ConvertTo-Json -Depth 5 | Out-File -FilePath $tempFile -Encoding UTF8

try {
    # Update the service
    Write-Host "Applying configuration update..." -ForegroundColor Yellow
    aws apprunner update-service --service-arn $serviceArn --source-configuration file://$tempFile --region $Region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service configuration updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "⏳ Deployment in progress..." -ForegroundColor Yellow
        Write-Host "🔍 Monitor with: aws apprunner describe-service --service-arn $serviceArn --region $Region --query 'Service.Status'" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to update service configuration" -ForegroundColor Red
    }
} finally {
    # Clean up temp file
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Cyan
Write-Host "   .\setup-secure-env.ps1           # Setup SSM parameters" -ForegroundColor White
Write-Host "   .\update-apprunner-env.ps1       # Update service env vars" -ForegroundColor White
Write-Host "   aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor White
