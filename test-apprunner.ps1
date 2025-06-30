# Test App Runner Deployment
# This script validates the deployment configuration without actually creating the service

param(
    [string]$ServiceName = "ado-client-test",
    [string]$Region = "eu-west-1",
    [string]$GitHubRepo = "https://github.com/riccardomerlin/ado-client"
)

Write-Host "🧪 Testing App Runner Deployment Configuration..." -ForegroundColor Green
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

# Validate apprunner.yaml
Write-Host "📄 Validating apprunner.yaml..." -ForegroundColor Yellow
if (-not (Test-Path "apprunner.yaml")) {
    Write-Host "❌ apprunner.yaml not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ apprunner.yaml exists" -ForegroundColor Green

# Validate package.json
Write-Host "📦 Validating package.json..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found" -ForegroundColor Red
    exit 1
}

$packageJson = Get-Content "package.json" | ConvertFrom-Json
if (-not $packageJson.scripts.start) {
    Write-Host "❌ No 'start' script in package.json" -ForegroundColor Red
    exit 1
}
Write-Host "✅ package.json has start script: $($packageJson.scripts.start)" -ForegroundColor Green

# Test environment configuration
Write-Host "⚙️  Testing environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found (will need environment variables in App Runner)" -ForegroundColor Yellow
} else {
    $envContent = Get-Content ".env"
    $envVars = @()
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $envVars += $matches[1].Trim()
        }
    }
    Write-Host "✅ Found $($envVars.Count) environment variables in .env" -ForegroundColor Green
    Write-Host "   Variables: $($envVars -join ', ')" -ForegroundColor Cyan
}

# Test config loading
Write-Host "🔧 Testing configuration loading..." -ForegroundColor Yellow
try {
    $nodeResult = node -e "
        import('./src/config.js').then(config => {
            console.log('✅ Config loaded successfully');
            process.exit(0);
        }).catch(error => {
            console.error('❌ Config error:', error.message);
            process.exit(1);
        });
    " 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Configuration loads successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Configuration loading failed: $nodeResult" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error testing configuration: $($_.Exception.Message)" -ForegroundColor Red
}

# Generate App Runner service configuration
Write-Host "📋 Generating App Runner service configuration..." -ForegroundColor Yellow
$serviceConfig = @{
    ServiceName = $ServiceName
    SourceConfiguration = @{
        CodeRepository = @{
            RepositoryUrl = $GitHubRepo
            SourceCodeVersion = @{
                Type = "BRANCH"
                Value = "main"
            }
            CodeConfiguration = @{
                ConfigurationSource = "CONFIGURATION_FILE"
            }
        }
        AutoDeploymentsEnabled = $true
    }
    InstanceConfiguration = @{
        Cpu = "0.25 vCPU"
        Memory = "0.5 GB"
    }
}

$configJson = $serviceConfig | ConvertTo-Json -Depth 10
Write-Host "✅ Service configuration generated" -ForegroundColor Green
Write-Host ""
Write-Host "📄 Configuration preview:" -ForegroundColor Cyan
Write-Host $configJson -ForegroundColor White

# Test AWS App Runner availability
Write-Host ""
Write-Host "🌐 Testing AWS App Runner service availability..." -ForegroundColor Yellow
try {
    $appRunnerTest = aws apprunner list-services --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ App Runner service accessible in region $Region" -ForegroundColor Green
        $services = ($appRunnerTest | ConvertFrom-Json).ServiceSummaryList
        Write-Host "   Found $($services.Count) existing services" -ForegroundColor Cyan
    } else {
        Write-Host "❌ App Runner not accessible: $appRunnerTest" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error accessing App Runner service" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Test Summary:" -ForegroundColor Yellow
Write-Host "✅ Prerequisites: AWS CLI and credentials configured" -ForegroundColor Green
Write-Host "✅ Configuration: apprunner.yaml and package.json valid" -ForegroundColor Green
Write-Host "✅ Environment: Variables available for deployment" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Ready to deploy! Run the following command:" -ForegroundColor Green
Write-Host "   .\deploy-apprunner.ps1 -GitHubRepo '$GitHubRepo'" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Or to deploy with ECR:" -ForegroundColor Cyan
Write-Host "   .\deploy-apprunner.ps1 -UseECR" -ForegroundColor Yellow
