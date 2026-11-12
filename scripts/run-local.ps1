param(
    [ValidateRange(1, 65535)]
    [int]$ApiPort = 8000,

    [ValidateRange(1, 65535)]
    [int]$ClientPort = 5173
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiDirectory = Join-Path $repoRoot "api"
$clientSource = Join-Path $repoRoot "src"
$containerfile = Join-Path $apiDirectory "Containerfile"
$staticServer = Join-Path $PSScriptRoot "serve-client.js"
$imageName = "poc-party-companies-house-api:local"
$containerName = "poc-party-local-api-$PID"
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "poc-party-local-$([guid]::NewGuid().ToString('N'))"
$staticProcess = $null
$containerStarted = $false
$clientPortWasSpecified = $PSBoundParameters.ContainsKey("ClientPort")

function Invoke-Podman {
    param([string[]]$Arguments)

    & podman @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Podman command failed: podman $($Arguments -join ' ')"
    }
}

function Test-LocalPortInUse {
    param([int]$Port)

    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen `
        -ErrorAction SilentlyContinue)
}

try {
    if (-not (Get-Command podman -ErrorAction SilentlyContinue)) {
        throw "Podman was not found. Install Podman Desktop or add podman to PATH."
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js was not found. Install Node.js to serve the browser client locally."
    }

    Write-Host "Rebuilding Party documentation..."
    & (Join-Path $PSScriptRoot "publish-docs.ps1")

    if (Test-LocalPortInUse $ClientPort) {
        if ($clientPortWasSpecified) {
            throw "Client port $ClientPort is already in use. Stop the existing client or choose another port with -ClientPort."
        }

        $requestedClientPort = $ClientPort
        do {
            $ClientPort++
        } while ($ClientPort -le 65535 -and (Test-LocalPortInUse $ClientPort))

        if ($ClientPort -gt 65535) {
            throw "No available client port was found after port $requestedClientPort."
        }
        Write-Host "Client port $requestedClientPort is in use; using available port $ClientPort."
    }

    & podman info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Starting the Podman machine..."
        Invoke-Podman @("machine", "start")
    }

    if (Test-Path $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    $clientDirectory = Join-Path $temporaryDirectory "client"
    Copy-Item -Path $clientSource -Destination $clientDirectory -Recurse
    $localApiUrl = "http://127.0.0.1:$ApiPort"
    Set-Content -LiteralPath (Join-Path $clientDirectory "config.js") `
        -Value "window.PARTY_API_BASE_URL = `"$localApiUrl`";" -Encoding ASCII

    Write-Host "Building the local API image..."
    Invoke-Podman @(
        "build", "--network", "host", "--tag", $imageName,
        "--file", $containerfile, $apiDirectory
    )
    Write-Host "Starting the API container on $localApiUrl..."
    Invoke-Podman @(
        "run", "--detach", "--name", $containerName, "--network", "host",
        $imageName, "python", "-m", "uvicorn", "main:app",
        "--host", "127.0.0.1", "--port", "$ApiPort"
    )
    $containerStarted = $true

    $healthUrl = "$localApiUrl/health"
    $apiReady = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
            if ($health.status -eq "ok") {
                $apiReady = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $apiReady) {
        & podman logs $containerName
        throw "The API container did not become healthy at $healthUrl."
    }

    $clientUrl = "http://127.0.0.1:$ClientPort/"
    $stdoutLog = Join-Path $temporaryDirectory "client-server.out.log"
    $stderrLog = Join-Path $temporaryDirectory "client-server.err.log"
    $staticProcess = Start-Process -FilePath "node" `
        -ArgumentList @("`"$staticServer`"", "`"$clientDirectory`"", "$ClientPort") `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog `
        -PassThru -WindowStyle Hidden

    $clientReady = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        try {
            if ($staticProcess.HasExited) {
                break
            }
            $clientResponse = Invoke-WebRequest -Uri $clientUrl -TimeoutSec 2 -UseBasicParsing
            if ($clientResponse.Content -match "Party Explorer") {
                $clientReady = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $clientReady) {
        if (Test-Path $stderrLog) {
            Get-Content -LiteralPath $stderrLog
        }
        throw "The Party client server did not start correctly at $clientUrl."
    }

    Write-Host "API docs: $localApiUrl/docs"
    Write-Host "Client:   $clientUrl"
    Start-Process $clientUrl
    Read-Host "Press Enter to stop the local client and API"
} catch {
    Write-Error $_
    exit 1
} finally {
    if ($staticProcess -and -not $staticProcess.HasExited) {
        Stop-Process -Id $staticProcess.Id -Force
    }
    if ($containerStarted) {
        & podman stop --time 5 $containerName *> $null
    }
    if (Test-Path $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
