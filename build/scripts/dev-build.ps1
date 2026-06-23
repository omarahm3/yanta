# Dev build for `wails3 dev`: compile the app binary without packaging the NSIS
# installer. Setting the env here (rather than via a Taskfile env:, which go-task
# does not propagate into nested tasks) ensures go-build-windows.ps1 sees it.
$env:BUILD_SKIP_INSTALLER = "1"
task build
exit $LASTEXITCODE
