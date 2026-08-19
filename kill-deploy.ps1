Get-Process node,cmd,powershell -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -gt (Get-Date).AddHours(-1) } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
"limpio"