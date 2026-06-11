package app

import "testing"

// TestDemoSeedingEnabled verifies that demo seeding is OFF by default so a fresh
// install lands on the guided onboarding flow (YANA-5), and ON only when the
// YANTA_SEED_DEMO escape hatch is explicitly set to "1".
func TestDemoSeedingEnabled(t *testing.T) {
	cases := []struct {
		name  string
		set   bool
		value string
		want  bool
	}{
		{name: "unset defaults to off", set: false, want: false},
		{name: "empty is off", set: true, value: "", want: false},
		{name: "zero is off", set: true, value: "0", want: false},
		{name: "true word is off", set: true, value: "true", want: false},
		{name: "one is on", set: true, value: "1", want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.set {
				t.Setenv("YANTA_SEED_DEMO", tc.value)
			} else {
				// Ensure a clean environment for the default case.
				t.Setenv("YANTA_SEED_DEMO", "")
			}
			if got := demoSeedingEnabled(); got != tc.want {
				t.Fatalf("demoSeedingEnabled() = %v, want %v", got, tc.want)
			}
		})
	}
}
