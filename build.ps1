<#
.SYNOPSIS
    Build and deploy the obsidian-azure-devops plugin to an Obsidian vault.

.PARAMETER VaultDir
    Path to the root of the Obsidian vault (the folder containing .obsidian).

.EXAMPLE
    .\build.ps1 -VaultDir "C:\Users\you\Documents\MyVault"
#>

param(
    [Parameter(Mandatory)]
    [string]$VaultDir
)

$ErrorActionPreference = "Stop"
$srcDir = $PSScriptRoot
$manifest = Get-Content (Join-Path $srcDir "manifest.json") -Raw | ConvertFrom-Json
$pluginId = $manifest.id
$targetDir = Join-Path $VaultDir ".obsidian\plugins\$pluginId"

Write-Host "Building $($manifest.name) ($pluginId)..." -ForegroundColor Cyan

try {
    Push-Location $srcDir

    Write-Host "  Installing dependencies..."
    npm install 2>$null | Out-Null

    Write-Host "  Building..."
    npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "BUILD FAILED" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Pop-Location

    if (-not (Test-Path $targetDir)) {
        New-Item $targetDir -ItemType Directory -Force | Out-Null
    }

    Copy-Item (Join-Path $srcDir "main.js") $targetDir -Force
    Copy-Item (Join-Path $srcDir "manifest.json") $targetDir -Force

    $stylesFile = Join-Path $srcDir "styles.css"
    if (Test-Path $stylesFile) {
        Copy-Item $stylesFile $targetDir -Force
    }

    Write-Host "Deployed to $targetDir" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
