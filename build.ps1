<#
.SYNOPSIS
    Build and deploy the obsidian-azure-devops plugin to an Obsidian vault.

.PARAMETER PluginsDir
    Path to the vault's .obsidian/plugins folder.

.EXAMPLE
    .\build.ps1 -PluginsDir "G:\My Drive\code\notes\.obsidian\plugins"
#>

param(
    [Parameter(Mandatory)]
    [string]$PluginsDir
)

$ErrorActionPreference = "Stop"
$srcDir = $PSScriptRoot
$manifest = Get-Content (Join-Path $srcDir "manifest.json") -Raw | ConvertFrom-Json
$pluginId = $manifest.id
$targetDir = Join-Path $PluginsDir $pluginId
$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "obsidian-plugin-$pluginId")

Write-Host "Building $($manifest.name) ($pluginId)..." -ForegroundColor Cyan

try {
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item $tmpDir -ItemType Directory -Force | Out-Null
    Copy-Item "$srcDir\*" $tmpDir\ -Recurse -Exclude node_modules

    Push-Location $tmpDir

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

    Copy-Item (Join-Path $tmpDir "main.js") $targetDir -Force
    Copy-Item (Join-Path $tmpDir "manifest.json") $targetDir -Force

    $stylesFile = Join-Path $tmpDir "styles.css"
    if (Test-Path $stylesFile) {
        Copy-Item $stylesFile $targetDir -Force
    }

    Write-Host "Deployed to $targetDir" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    if ((Get-Location).Path -eq $tmpDir) { Pop-Location }
    exit 1
}
