param(
    [Parameter(Mandatory = $true)]
    [string]$TaskName
)

task $TaskName
$code = $LASTEXITCODE

# Treat Windows interrupt/termination codes as graceful exits in Wails dev mode.
if ($code -eq 0 -or $code -eq 201 -or $code -eq -1073741510 -or $code -eq 3221225786) {
    exit 0
}

exit $code
