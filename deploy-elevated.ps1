$ErrorActionPreference = 'Continue'
$log = 'D:\progra\carto-node\deploy.log'
$fnm = 'C:\Users\amontoya\AppData\Roaming\fnm\node-versions\v22.22.3\installation'
$env:PATH = "$fnm;$env:PATH"
$env:CI = 'true'
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\amontoya\Downloads\cartografia-38cc3-firebase-adminsdk-fbsvc-1150123577.json'
"INICIO node=$(& "$fnm\node.exe" -v) $(Get-Date -Format o)" | Out-File -FilePath $log -Encoding utf8
Set-Location -LiteralPath 'D:\progra\carto-node'
cmd /c "npm run deploy:hosting >> deploy.log 2>&1"
"FIN exit=$LASTEXITCODE $(Get-Date -Format o)" | Add-Content -Path $log -Encoding utf8