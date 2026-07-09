package window

import "github.com/wailsapp/wails/v3/pkg/application"

// ClampToVisibleArea takes a saved window rect and a list of screens, and returns
// a corrected rect that's guaranteed to be visible on at least one screen.
// If the saved rect is completely off-screen, it falls back to centering on the primary screen.
func ClampToVisibleArea(saved application.Rect, screens []*application.Screen) application.Rect {
	if len(screens) == 0 {
		return application.Rect{
			X:      100,
			Y:      100,
			Width:  DefaultWidth,
			Height: DefaultHeight,
		}
	}

	// Find primary screen
	var primary *application.Screen
	for _, s := range screens {
		if s.IsPrimary {
			primary = s
			break
		}
	}
	if primary == nil {
		primary = screens[0]
	}

	// Check if saved rect intersects with any screen's work area
	for _, screen := range screens {
		workArea := screen.WorkArea
		intersection := saved.Intersect(workArea)
		if !intersection.IsEmpty() {
			// At least 1 pixel visible - clamp to work area
			return clampToWorkArea(saved, workArea)
		}
	}

	// Completely off-screen - center on primary
	return centerOnScreen(primary)
}

// clampToWorkArea ensures the rect fits within the work area, preserving size when possible.
func clampToWorkArea(rect, workArea application.Rect) application.Rect {
	result := rect

	// Clamp width/height to work area size
	if result.Width > workArea.Width {
		result.Width = workArea.Width
	}
	if result.Height > workArea.Height {
		result.Height = workArea.Height
	}

	// Clamp position to keep window within work area
	if result.X < workArea.X {
		result.X = workArea.X
	}
	if result.Y < workArea.Y {
		result.Y = workArea.Y
	}
	if result.X+result.Width > workArea.X+workArea.Width {
		result.X = workArea.X + workArea.Width - result.Width
	}
	if result.Y+result.Height > workArea.Y+workArea.Height {
		result.Y = workArea.Y + workArea.Height - result.Height
	}

	return result
}

// centerOnScreen centers a window of default size on the given screen.
func centerOnScreen(screen *application.Screen) application.Rect {
	workArea := screen.WorkArea
	width := DefaultWidth
	height := DefaultHeight

	if width > workArea.Width {
		width = workArea.Width
	}
	if height > workArea.Height {
		height = workArea.Height
	}

	x := workArea.X + (workArea.Width-width)/2
	y := workArea.Y + (workArea.Height-height)/2

	return application.Rect{
		X:      x,
		Y:      y,
		Width:  width,
		Height: height,
	}
}
