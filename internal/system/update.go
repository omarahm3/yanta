package system

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"yanta/internal/logger"
)

const (
	// githubLatestReleaseURL is the GitHub Releases API endpoint for the
	// latest published (non-draft, non-prerelease) release of YANTA.
	githubLatestReleaseURL = "https://api.github.com/repos/omarahm3/yanta/releases/latest"

	// updateCheckTimeout bounds the network call so a slow or unreachable
	// GitHub never blocks the caller. The check is best-effort.
	updateCheckTimeout = 8 * time.Second
)

// UpdateInfo describes the result of an auto-update check against GitHub
// Releases. It is intentionally non-error-bearing for the common "no network"
// case: callers get Available=false and can stay silent rather than nag the
// user with failures they cannot act on.
type UpdateInfo struct {
	// Available is true only when a strictly newer release than the running
	// build was found.
	Available bool `json:"available"`
	// CurrentVersion is the running build version (without a leading "v").
	CurrentVersion string `json:"currentVersion"`
	// LatestVersion is the newest release version found (without a leading
	// "v"). Empty when the check could not be completed.
	LatestVersion string `json:"latestVersion"`
	// ReleaseURL links to the release page so the user can review and
	// download the update themselves. YANTA never self-installs.
	ReleaseURL string `json:"releaseUrl"`
	// ReleaseNotes is the release body markdown, if any.
	ReleaseNotes string `json:"releaseNotes"`
	// PublishedAt is the release publish timestamp (RFC3339), if any.
	PublishedAt string `json:"publishedAt"`
	// Checked is true when the remote check actually ran and returned a
	// usable response. It is false for skipped (dev build) or failed checks.
	Checked bool `json:"checked"`
}

// githubRelease is the subset of the GitHub Releases API payload we consume.
type githubRelease struct {
	TagName     string `json:"tag_name"`
	HTMLURL     string `json:"html_url"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	Draft       bool   `json:"draft"`
	Prerelease  bool   `json:"prerelease"`
}

// CheckForUpdate queries GitHub Releases for the latest version and compares it
// against the running build. The call is best-effort and non-blocking from the
// UI's perspective: it never self-installs and surfaces a newer release only so
// the frontend can offer a dismissible, non-intrusive prompt.
//
// Development builds (version "dev" or empty) are skipped — they have no
// meaningful version to compare and should not nag local/dev users.
func (s *Service) CheckForUpdate(ctx context.Context) (*UpdateInfo, error) {
	client := &http.Client{Timeout: updateCheckTimeout}
	return checkForUpdate(ctx, client, githubLatestReleaseURL, BuildVersion)
}

// checkForUpdate is the testable core of CheckForUpdate. It is separated from
// the Service method so tests can inject an httptest server and a fixed current
// version.
func checkForUpdate(
	ctx context.Context,
	client *http.Client,
	releaseURL string,
	currentVersion string,
) (*UpdateInfo, error) {
	current := normalizeVersion(currentVersion)

	// Dev/unknown builds have no comparable version; skip silently.
	if current == "" || strings.EqualFold(currentVersion, "dev") {
		logger.Debugf("update check skipped for non-release build %q", currentVersion)
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: current,
			Checked:        false,
		}, nil
	}

	reqCtx, cancel := context.WithTimeout(ctx, updateCheckTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, releaseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build update request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "yanta-update-check")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("update check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update check returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read update response: %w", err)
	}

	var release githubRelease
	if err := json.Unmarshal(body, &release); err != nil {
		return nil, fmt.Errorf("failed to parse update response: %w", err)
	}

	latest := normalizeVersion(release.TagName)
	if latest == "" {
		return nil, fmt.Errorf("release has no usable tag name: %q", release.TagName)
	}

	info := &UpdateInfo{
		Available:      compareVersions(latest, current) > 0,
		CurrentVersion: current,
		LatestVersion:  latest,
		ReleaseURL:     release.HTMLURL,
		ReleaseNotes:   release.Body,
		PublishedAt:    release.PublishedAt,
		Checked:        true,
	}

	logger.Infof(
		"update check: current=%s latest=%s available=%t",
		current, latest, info.Available,
	)

	return info, nil
}

// normalizeVersion strips a leading "v" and surrounding whitespace from a
// version or tag string (e.g. "v1.2.3" -> "1.2.3").
func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	return v
}

// compareVersions compares two dot-separated numeric version strings and
// returns -1 if a < b, 0 if equal, and 1 if a > b. Pre-release and build
// metadata (anything after a "-" or "+") is ignored so "1.2.3-beta" compares
// equal to "1.2.3"; this is deliberately conservative to avoid prompting users
// to "update" between equivalent numeric versions. Non-numeric or unparseable
// inputs compare as equal (0) so a malformed remote tag never triggers a prompt.
func compareVersions(a, b string) int {
	as, aok := versionCore(a)
	bs, bok := versionCore(b)
	if !aok || !bok {
		return 0
	}

	maxLen := len(as)
	if len(bs) > maxLen {
		maxLen = len(bs)
	}

	for i := 0; i < maxLen; i++ {
		var av, bv int
		if i < len(as) {
			av = as[i]
		}
		if i < len(bs) {
			bv = bs[i]
		}
		if av < bv {
			return -1
		}
		if av > bv {
			return 1
		}
	}
	return 0
}

// versionCore parses the numeric core of a semantic version into its integer
// components. It returns false if any component is non-numeric.
func versionCore(v string) ([]int, bool) {
	v = normalizeVersion(v)
	// Drop pre-release ("-") and build ("+") metadata.
	if idx := strings.IndexAny(v, "-+"); idx >= 0 {
		v = v[:idx]
	}
	if v == "" {
		return nil, false
	}

	parts := strings.Split(v, ".")
	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil, false
		}
		nums = append(nums, n)
	}
	return nums, true
}
