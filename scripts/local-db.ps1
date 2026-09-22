param(
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localRoot = Join-Path $workspace '.local'
$dataRoot = Join-Path $localRoot 'postgres-data'
$passwordFile = Join-Path $localRoot 'postgres-password'
$logFile = Join-Path $localRoot 'postgres.log'
$envFile = Join-Path $workspace '.env'

New-Item -ItemType Directory -Force -Path $localRoot | Out-Null

foreach ($tool in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $tool))) {
    throw "PostgreSQL tool not found: $tool in $PostgresBin"
  }
}

if (-not (Test-Path -LiteralPath $dataRoot)) {
  if ((Test-Path -LiteralPath $passwordFile) -or (Test-Path -LiteralPath $envFile)) {
    throw 'Local database files are inconsistent; inspect .local and .env before retrying.'
  }
  $secretBytes = New-Object byte[] 32
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($secretBytes) } finally { $random.Dispose() }
  $secret = ([BitConverter]::ToString($secretBytes) -replace '-', '').ToLowerInvariant()
  Set-Content -LiteralPath $passwordFile -Value $secret -NoNewline
  & (Join-Path $PostgresBin 'initdb.exe') -D $dataRoot -U orvok_local "--pwfile=$passwordFile" '--auth-host=scram-sha-256' '--auth-local=scram-sha-256' '--encoding=UTF8' '--no-instructions'
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
  Set-Content -LiteralPath $envFile -Value "DATABASE_URL=postgresql://orvok_local:$secret@127.0.0.1:$Port/orvok_dev?schema=public`nAPP_ENV=development"
}

if (-not (Test-Path -LiteralPath $passwordFile) -or -not (Test-Path -LiteralPath $envFile)) {
  throw 'Missing local credential or .env; inspect the local cluster before retrying.'
}

& (Join-Path $PostgresBin 'pg_ctl.exe') -D $dataRoot status *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $dataRoot -l $logFile -o "-h 127.0.0.1 -p $Port" start
  if ($LASTEXITCODE -ne 0) { throw 'pg_ctl start failed' }
}

$env:PGPASSWORD = Get-Content -LiteralPath $passwordFile -Raw
try {
  $exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $Port -U orvok_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'orvok_dev'"
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL connection failed' }
  if (($exists | Out-String).Trim() -ne '1') {
    & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $Port -U orvok_local orvok_dev
    if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Output "Local PostgreSQL ready on 127.0.0.1:$Port; credentials remain only in ignored files."
