//go:build production

package main

// isProductionBuild is true when compiled with `-tags production`. This is the
// same tag that flips Wails into production mode (DevTools/inspector disabled),
// and it strips debug-only affordances such as the View > Reload menu item.
const isProductionBuild = true
