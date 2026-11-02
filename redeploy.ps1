# Builds the Weber installer, closes Weber, installs the new build silently and opens it again.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
& (Join-Path $env:USERPROFILE 'Jarvis\node_modules\.bin\electron-builder.cmd') --win nsis
if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }
Get-Process Weber -ErrorAction SilentlyContinue | ForEach-Object { [void]$_.CloseMainWindow() }
Start-Sleep 3
Get-Process Weber -ErrorAction SilentlyContinue | Stop-Process -Force
$setup = Join-Path $PSScriptRoot 'dist\Weber Setup 1.0.0.exe'
$p = Start-Process -FilePath $setup -ArgumentList '/S' -PassThru -Wait
"installer exit $($p.ExitCode)"
Copy-Item $setup (Join-Path $env:USERPROFILE 'Downloads\AIReason Installers\') -Force
Start-Process (Join-Path $env:LOCALAPPDATA 'Programs\weber-browser\Weber.exe')
'WEBER REDEPLOYED'
