# Setup Secure Environment Variables for App Runner (Copy-Paste Friendly)
# This script creates AWS SSM Parameter Store entries for sensitive data

param(
    [string]$Region = "eu-west-1",
    [string]$ServiceName = "ado-client"
)

Write-Host "🔐 Setting up secure environment variables for App Runner..." -ForegroundColor Green
Write-Host "💡 This version allows copy-paste for easier input!" -ForegroundColor Cyan

# Function to create secure parameter with copy-paste support
function New-SecureParameter {
    param($Name, $Description, $IsSecret = $true, $DefaultValue = "")
    if ($DefaultValue) {
        Write-Host "Enter value for ${Name} (default: $DefaultValue):" -ForegroundColor Yellow
        $Value = Read-Host "Value"
        if ([string]::IsNullOrWhiteSpace($Value)) {
            $Value = $DefaultValue
        }
    } else {
        Write-Host "Enter value for ${Name}:" -ForegroundColor Yellow
        $Value = Read-Host "Value"
    }
    
    $ParameterName = "/apprunner/$ServiceName/$Name"
    
    if ($IsSecret) {
        Write-Host "Creating SecureString parameter: $ParameterName" -ForegroundColor Cyan
        aws ssm put-parameter --name $ParameterName --value $Value --type "SecureString" --description $Description --region $Region --overwrite
    } else {
        Write-Host "Creating String parameter: $ParameterName" -ForegroundColor Cyan
        aws ssm put-parameter --name $ParameterName --value $Value --type "String" --description $Description --region $Region --overwrite
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Created: $Name" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create: $Name" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📋 Setting up Azure DevOps configuration parameters..." -ForegroundColor Yellow
Write-Host "💡 You can copy-paste values directly into the prompts" -ForegroundColor Cyan

# Non-sensitive parameters with defaults from .env if available
$envDefaults = @{}
if (Test-Path ".env") {
    Write-Host "📄 Found .env file, using values as defaults..." -ForegroundColor Cyan
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $envDefaults[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}

Write-Host ""
New-SecureParameter "ORG_URL" "Azure DevOps Organization URL" $false $envDefaults["ORG_URL"]
New-SecureParameter "PROJECT_NAME" "Azure DevOps Project Name" $false $envDefaults["PROJECT_NAME"]
New-SecureParameter "TEAM_ID" "Azure DevOps Team ID" $false $envDefaults["TEAM_ID"]
New-SecureParameter "API_VERSION" "Azure DevOps API Version" $false $envDefaults["API_VERSION"]
New-SecureParameter "PORT" "Server Port" $false "3000"
New-SecureParameter "DEFAULT_RELEASE" "Default Release Version" $false $envDefaults["DEFAULT_RELEASE"]
New-SecureParameter "DEFAULT_AREA_PATH" "Default Area Path" $false $envDefaults["DEFAULT_AREA_PATH"]
New-SecureParameter "RELEASE_FIELD_NAME" "Release Field Name" $false $envDefaults["RELEASE_FIELD_NAME"]
New-SecureParameter "DEFAULT_RELATIONSHIP_STRATEGY" "Default Relationship Strategy" $false $envDefaults["DEFAULT_RELATIONSHIP_STRATEGY"]

# Sensitive parameters
Write-Host ""
Write-Host "🔑 Setting up sensitive parameters..." -ForegroundColor Red
Write-Host "⚠️  Make sure nobody is watching your screen!" -ForegroundColor Yellow
New-SecureParameter "ADO_CLIENT_PAT" "Azure DevOps Personal Access Token" $true

Write-Host ""
Write-Host "✅ Parameters created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: .\update-apprunner-env.ps1 to configure the service" -ForegroundColor White
Write-Host "2. Check deployment status with the provided commands" -ForegroundColor White
