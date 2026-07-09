package window

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestClampToVisibleArea_EmptyScreens(t *testing.T) {
	saved := application.Rect{X: 100, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, nil)

	assert.Equal(t, 100, result.X)
	assert.Equal(t, 100, result.Y)
	assert.Equal(t, DefaultWidth, result.Width)
	assert.Equal(t, DefaultHeight, result.Height)
}

func TestClampToVisibleArea_VisibleOnPrimary(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 100, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	assert.Equal(t, saved, result)
}

func TestClampToVisibleArea_PartiallyOffScreen_Right(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 1800, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	assert.Equal(t, 1120, result.X) // 1920 - 800
	assert.Equal(t, 100, result.Y)
	assert.Equal(t, 800, result.Width)
	assert.Equal(t, 600, result.Height)
}

func TestClampToVisibleArea_PartiallyOffScreen_Bottom(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 100, Y: 900, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	assert.Equal(t, 100, result.X)
	assert.Equal(t, 480, result.Y) // 1080 - 600
	assert.Equal(t, 800, result.Width)
	assert.Equal(t, 600, result.Height)
}

func TestClampToVisibleArea_CompletelyOffScreen(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 5000, Y: 5000, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Should be centered on primary
	expectedX := (1920 - DefaultWidth) / 2
	expectedY := (1080 - DefaultHeight) / 2
	assert.Equal(t, expectedX, result.X)
	assert.Equal(t, expectedY, result.Y)
	assert.Equal(t, DefaultWidth, result.Width)
	assert.Equal(t, DefaultHeight, result.Height)
}

func TestClampToVisibleArea_MultiMonitor_LeftScreen(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 1920, Y: 0, Width: 1920, Height: 1080},
		},
		{
			IsPrimary: false,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 500, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Should stay on left screen
	assert.Equal(t, 500, result.X)
	assert.Equal(t, 100, result.Y)
}

func TestClampToVisibleArea_MultiMonitor_RightScreen(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
		{
			IsPrimary: false,
			WorkArea:  application.Rect{X: 1920, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 2500, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Should stay on right screen
	assert.Equal(t, 2500, result.X)
	assert.Equal(t, 100, result.Y)
}

func TestClampToVisibleArea_UnpluggedMonitor(t *testing.T) {
	// Simulate a monitor that was unplugged - saved position is now off-screen
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	// Window was on second monitor at X=2500, but now only primary exists
	saved := application.Rect{X: 2500, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Should be centered on primary
	expectedX := (1920 - DefaultWidth) / 2
	expectedY := (1080 - DefaultHeight) / 2
	assert.Equal(t, expectedX, result.X)
	assert.Equal(t, expectedY, result.Y)
}

func TestClampToVisibleArea_WindowLargerThanScreen(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 800, Height: 600},
		},
	}
	saved := application.Rect{X: 100, Y: 100, Width: 1920, Height: 1080}
	result := ClampToVisibleArea(saved, screens)

	// Should be clamped to screen size
	assert.Equal(t, 0, result.X)
	assert.Equal(t, 0, result.Y)
	assert.Equal(t, 800, result.Width)
	assert.Equal(t, 600, result.Height)
}

func TestClampToVisibleArea_NegativeCoordinates(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: true,
			WorkArea:  application.Rect{X: -1920, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: -500, Y: 100, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Window right edge (300) is off-screen (work area ends at 0), so clamp to -800
	assert.Equal(t, -800, result.X)
	assert.Equal(t, 100, result.Y)
}

func TestClampToVisibleArea_NoPrimaryScreen(t *testing.T) {
	screens := []*application.Screen{
		{
			IsPrimary: false,
			WorkArea:  application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
	}
	saved := application.Rect{X: 5000, Y: 5000, Width: 800, Height: 600}
	result := ClampToVisibleArea(saved, screens)

	// Should use first screen as fallback
	expectedX := (1920 - DefaultWidth) / 2
	expectedY := (1080 - DefaultHeight) / 2
	assert.Equal(t, expectedX, result.X)
	assert.Equal(t, expectedY, result.Y)
}
