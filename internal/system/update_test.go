package system

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"1.2.4", "1.2.3", 1},
		{"1.2.3", "1.2.4", -1},
		{"2.0.0", "1.9.9", 1},
		{"1.10.0", "1.9.0", 1},
		{"1.2", "1.2.0", 0},
		{"1.2.0", "1.2", 0},
		{"v1.2.3", "1.2.3", 0},
		{"1.2.3-beta", "1.2.3", 0},
		{"1.3.0-rc1", "1.2.9", 1},
		// Malformed inputs compare equal so they never trigger a prompt.
		{"1.-2.3", "1.0.0", 0},
		{"1.0.0", "1.-2.3", 0},
		{"garbage", "1.2.3", 0},
		{"1.2.3", "garbage", 0},
	}

	for _, tc := range cases {
		t.Run(tc.a+"_vs_"+tc.b, func(t *testing.T) {
			assert.Equal(t, tc.want, compareVersions(tc.a, tc.b))
		})
	}
}

func TestNormalizeVersion(t *testing.T) {
	assert.Equal(t, "1.2.3", normalizeVersion("v1.2.3"))
	assert.Equal(t, "1.2.3", normalizeVersion("V1.2.3"))
	assert.Equal(t, "1.2.3", normalizeVersion("  1.2.3 "))
	assert.Equal(t, "", normalizeVersion(""))
}

func newReleaseServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "application/vnd.github+json", r.Header.Get("Accept"))
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

func TestCheckForUpdate_NewerAvailable(t *testing.T) {
	srv := newReleaseServer(t, http.StatusOK, `{
		"tag_name": "v1.4.0",
		"html_url": "https://github.com/omarahm3/yanta/releases/tag/v1.4.0",
		"body": "Shiny new stuff",
		"published_at": "2026-06-01T00:00:00Z"
	}`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.NoError(t, err)
	assert.True(t, info.Available)
	assert.True(t, info.Checked)
	assert.Equal(t, "1.3.0", info.CurrentVersion)
	assert.Equal(t, "1.4.0", info.LatestVersion)
	assert.Equal(t, "https://github.com/omarahm3/yanta/releases/tag/v1.4.0", info.ReleaseURL)
	assert.Equal(t, "Shiny new stuff", info.ReleaseNotes)
}

func TestCheckForUpdate_UpToDate(t *testing.T) {
	srv := newReleaseServer(t, http.StatusOK, `{"tag_name": "v1.3.0", "html_url": "x"}`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.NoError(t, err)
	assert.False(t, info.Available)
	assert.True(t, info.Checked)
	assert.Equal(t, "1.3.0", info.LatestVersion)
}

func TestCheckForUpdate_OlderRemoteNeverPrompts(t *testing.T) {
	srv := newReleaseServer(t, http.StatusOK, `{"tag_name": "v1.2.0", "html_url": "x"}`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.NoError(t, err)
	assert.False(t, info.Available)
}

func TestCheckForUpdate_DevBuildSkipped(t *testing.T) {
	// No server should be contacted for a dev build; pass an unreachable URL
	// to prove the network is never touched.
	info, err := checkForUpdate(
		context.Background(),
		&http.Client{},
		"http://127.0.0.1:0/never",
		"dev",
	)
	require.NoError(t, err)
	assert.False(t, info.Available)
	assert.False(t, info.Checked)
}

func TestCheckForUpdate_HTTPErrorStatus(t *testing.T) {
	srv := newReleaseServer(t, http.StatusInternalServerError, `oops`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.Error(t, err)
	assert.Nil(t, info)
}

func TestCheckForUpdate_MalformedJSON(t *testing.T) {
	srv := newReleaseServer(t, http.StatusOK, `{not json`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.Error(t, err)
	assert.Nil(t, info)
}

func TestCheckForUpdate_EmptyTag(t *testing.T) {
	srv := newReleaseServer(t, http.StatusOK, `{"tag_name": "", "html_url": "x"}`)
	defer srv.Close()

	info, err := checkForUpdate(context.Background(), srv.Client(), srv.URL, "1.3.0")
	require.Error(t, err)
	assert.Nil(t, info)
}
