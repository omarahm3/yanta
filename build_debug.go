//go:build !production

package main

// isProductionBuild is false in any build without the `production` build tag.
// Wails itself runs in debug mode here (DevTools/inspector enabled), so debug
// affordances such as the View > Reload menu item stay available for local dev.
const isProductionBuild = false
