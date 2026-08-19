# Re-aplica el parche webpack a firebase-tools (se pierde con `npm install`).
# Turbopack 16.3 genera symlinks ABSOLUTOS (D:\progra\...) para serverExternalPackages
# que no existen en GCP y rompen el SSR en Cloud Functions. Con --webpack los
# externals se resuelven contra node_modules reales (presentes en el dist).
# EJECUTAR tras cada `npm install` y antes de cualquier `npm run deploy:hosting`.
$file = 'D:\progra\carto-node\node_modules\firebase-tools\lib\frameworks\next\index.js'
$content = Get-Content -LiteralPath $file -Raw
if ($content -match '"build", "--webpack"') {
  Write-Host 'Parche webpack YA aplicado.' -ForegroundColor Green
} elseif ($content -match 'spawn\(cli, \["build"\],') {
  $patched = $content -replace 'spawn\(cli, \["build"\],', 'spawn(cli, ["build", "--webpack"],'
  Set-Content -LiteralPath $file -Value $patched -NoNewline
  Write-Host 'Parche webpack APLICADO.' -ForegroundColor Green
} else {
  Write-Host 'ADVERTENCIA: no se encontro el patron esperado en firebase-tools. Revisar manualmente.' -ForegroundColor Yellow
  exit 1
}