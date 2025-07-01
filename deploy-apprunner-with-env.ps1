# Deploy to AWS App Runner with Environment Variables from SSM Parameter Store
# This script creates an App Runner service with environment variables loaded from SSM

param(
    [string]$ServiceName = "ado-client",
    [string]$Region = "eu-west-1"
)

Write-Host "🚀 Deploying to AWS App Runner with SSM environment variables..." -ForegroundColor Green

# Function to get parameter value from SSM
function Get-ParameterValue {
    param($ParameterName, $ServiceName, $Region)
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

# Load environment variables from SSM Parameter Store
Write-Host "📋 Loading environment variables from SSM Parameter Store..." -ForegroundColor Cyan

$envVars = @{
    "NODE_ENV" = "production"
}

$parameters = @(
    "ORG_URL", "PROJECT_NAME", "TEAM_ID", "API_VERSION", "PORT",
    "DEFAULT_RELEASE", "DEFAULT_AREA_PATH", "RELEASE_FIELD_NAME",
    "DEFAULT_RELATIONSHIP_STRATEGY", "ADO_CLIENT_PAT"
)

foreach ($param in $parameters) {
    $value = Get-ParameterValue $param $ServiceName $Region
    if ($value) {
        $envVars[$param] = $value
        Write-Host "✅ Loaded: $param" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Missing: $param" -ForegroundColor Yellow
    }
}

Write-Host "📊 Total environment variables loaded: $($envVars.Count)" -ForegroundColor Cyan

# Build and push Docker image
$accountId = aws sts get-caller-identity --query Account --output text
$ecrRepo = "$accountId.dkr.ecr.$Region.amazonaws.com/$ServiceName"

Write-Host "🐳 Building and pushing Docker image..." -ForegroundColor Yellow
aws ecr get-login-password --region $Region | wsl docker login --username AWS --password-stdin $ecrRepo
wsl docker build -t $ServiceName .
wsl docker tag $ServiceName`:latest $ecrRepo`:latest
wsl docker push $ecrRepo`:latest
$imageUri = "$ecrRepo`:latest"
Write-Host "✅ Image pushed to: $imageUri" -ForegroundColor Green

# Convert environment variables to JSON format
$envVarsJson = @{}
foreach ($key in $envVars.Keys) {
    $envVarsJson[$key] = $envVars[$key]
}

# Create service configuration with environment variables
$roleArn = "arn:aws:iam::${accountId}:role/AppRunnerECRAccessRole"

$serviceConfig = @{
    ServiceName = $ServiceName
    SourceConfiguration = @{
        ImageRepository = @{
            ImageIdentifier = $imageUri
            ImageConfiguration = @{
                Port = "3000"
                RuntimeEnvironmentVariables = $envVarsJson
            }
            ImageRepositoryType = "ECR"
        }
        AutoDeploymentsEnabled = $false
        AuthenticationConfiguration = @{
            AccessRoleArn = $roleArn
        }
    }
    InstanceConfiguration = @{
        Cpu = "0.25 vCPU"
        Memory = "0.5 GB"
    }
}

# Save configuration to temporary file
$tempConfigFile = [System.IO.Path]::GetTempFileName() + ".json"
$serviceConfig | ConvertTo-Json -Depth 5 | Out-File -FilePath $tempConfigFile -Encoding UTF8

try {
    # Create the service
    Write-Host "🚀 Creating App Runner service with environment variables..." -ForegroundColor Yellow
    $result = aws apprunner create-service --cli-input-json file://$tempConfigFile --region $Region
    
    if ($LASTEXITCODE -eq 0) {
        $serviceArn = ($result | ConvertFrom-Json).Service.ServiceArn
        Write-Host "✅ App Runner service created successfully!" -ForegroundColor Green
        Write-Host "Service ARN: $serviceArn" -ForegroundColor Cyan
        
        Write-Host ""
        Write-Host "⏳ Service is being deployed. This may take 5-10 minutes..." -ForegroundColor Yellow
        Write-Host "🔍 Monitor with: aws apprunner describe-service --service-arn $serviceArn --region $Region --query 'Service.Status'" -ForegroundColor Cyan
        
        # Wait and show initial status
        Start-Sleep -Seconds 15
        Write-Host "📊 Checking initial status..." -ForegroundColor Yellow
        $status = aws apprunner describe-service --service-arn $serviceArn --region $Region --query 'Service.Status' --output text
        Write-Host "Current status: $status" -ForegroundColor Cyan
        
        # Show service URL
        $serviceUrl = aws apprunner describe-service --service-arn $serviceArn --region $Region --query 'Service.ServiceUrl' --output text
        Write-Host "🌐 Service URL: https://$serviceUrl" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Failed to create App Runner service" -ForegroundColor Red
        exit 1
    }
} finally {
    # Clean up temp file
    Remove-Item $tempConfigFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Wait for deployment to complete (status: RUNNING)" -ForegroundColor White
Write-Host "2. Test your application at the service URL" -ForegroundColor White
Write-Host "3. Use .\update-apprunner.ps1 for future code updates" -ForegroundColor White
Write-Host ""
Write-Host "💡 Useful commands:" -ForegroundColor Cyan
Write-Host "   aws apprunner describe-service --service-arn $serviceArn --region $Region" -ForegroundColor White
Write-Host "   aws apprunner list-services --region $Region" -ForegroundColor White
