$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$documentationFiles = @("recreation-spec.md", "api-contract.md")

foreach ($fileName in $documentationFiles) {
    $sourceDocumentation = Join-Path $repoRoot "docs\$fileName"
    $publishedDocumentation = Join-Path $repoRoot "src\$fileName"

    if (-not (Test-Path -LiteralPath $sourceDocumentation)) {
        throw "Source documentation was not found at $sourceDocumentation."
    }

    Copy-Item -LiteralPath $sourceDocumentation -Destination $publishedDocumentation -Force
    Write-Host "Published Party documentation to $publishedDocumentation."
}
