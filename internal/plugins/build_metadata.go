package plugins

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const pluginBuildMetadataBuilder = "yanta-plugin-cli"
const pluginBuildMetadataTool = "bun"
const pluginBuildMetadataFormat = "yanta-esm-v1"

var forbiddenBundledRuntimePackages = []string{
	"react",
	"react-dom",
	"@blocknote/core",
	"@blocknote/react",
	"yjs",
}

type PluginBuildMetadata struct {
	Builder                 string   `json:"builder"`
	BuilderVersion          string   `json:"builder_version"`
	BuildTool               string   `json:"build_tool"`
	Format                  string   `json:"format"`
	HostExternals           []string `json:"host_externals"`
	DetectedBundledPackages []string `json:"detected_bundled_packages"`
	EntryHashSHA256         string   `json:"entry_hash_sha256"`
	GeneratedAt             string   `json:"generated_at"`
}

type pluginBuildCheckFailure struct {
	Code    string
	Message string
}

func checkPluginBuildMetadata(pluginRoot string) *pluginBuildCheckFailure {
	metaPath := filepath.Join(pluginRoot, requiredPluginBuildMetadataFile)
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &pluginBuildCheckFailure{
				Code:    PluginErrBuildMetadataMissing,
				Message: fmt.Sprintf("missing required build metadata %q", requiredPluginBuildMetadataFile),
			}
		}
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("read build metadata failed: %v", err),
		}
	}

	var meta PluginBuildMetadata
	if err := json.Unmarshal(metaData, &meta); err != nil {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("invalid build metadata JSON: %v", err),
		}
	}

	if strings.TrimSpace(meta.Builder) != pluginBuildMetadataBuilder {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("metadata builder must be %q", pluginBuildMetadataBuilder),
		}
	}
	if strings.TrimSpace(meta.BuildTool) != pluginBuildMetadataTool {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("metadata build_tool must be %q", pluginBuildMetadataTool),
		}
	}
	if strings.TrimSpace(meta.Format) != pluginBuildMetadataFormat {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("metadata format must be %q", pluginBuildMetadataFormat),
		}
	}

	hostExternals := normalizeStringList(meta.HostExternals)
	if len(hostExternals) == 0 {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: "metadata host_externals must not be empty",
		}
	}
	for _, required := range forbiddenBundledRuntimePackages {
		if !containsString(hostExternals, required) {
			return &pluginBuildCheckFailure{
				Code:    PluginErrBuildMetadataInvalid,
				Message: fmt.Sprintf("metadata host_externals missing %q", required),
			}
		}
	}

	entryPath := filepath.Join(pluginRoot, requiredPluginEntrypoint)
	entryData, err := os.ReadFile(entryPath)
	if err != nil {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: fmt.Sprintf("read entrypoint for metadata validation failed: %v", err),
		}
	}
	entryHash := sha256.Sum256(entryData)
	expectedHash := strings.ToLower(strings.TrimSpace(meta.EntryHashSHA256))
	actualHash := hex.EncodeToString(entryHash[:])
	if expectedHash == "" {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildMetadataInvalid,
			Message: "metadata entry_hash_sha256 is required",
		}
	}
	if expectedHash != actualHash {
		return &pluginBuildCheckFailure{
			Code:    PluginErrBuildHashMismatch,
			Message: "main.js hash does not match metadata entry_hash_sha256",
		}
	}

	detectedByBundleScan := detectBundledForbiddenPackagesFromBundle(string(entryData))
	if len(detectedByBundleScan) > 0 {
		return &pluginBuildCheckFailure{
			Code:    PluginErrForbiddenBundle,
			Message: fmt.Sprintf("bundle includes forbidden runtime packages: %s", strings.Join(detectedByBundleScan, ", ")),
		}
	}

	detectedBundled := normalizeStringList(meta.DetectedBundledPackages)
	forbiddenDetected := make([]string, 0, len(detectedBundled))
	for _, pkg := range detectedBundled {
		if containsString(forbiddenBundledRuntimePackages, pkg) {
			forbiddenDetected = append(forbiddenDetected, pkg)
		}
	}
	if len(forbiddenDetected) > 0 {
		sort.Strings(forbiddenDetected)
		return &pluginBuildCheckFailure{
			Code:    PluginErrForbiddenBundle,
			Message: fmt.Sprintf("bundle includes forbidden runtime packages: %s", strings.Join(forbiddenDetected, ", ")),
		}
	}

	return nil
}

func detectBundledForbiddenPackagesFromBundle(bundle string) []string {
	type packagePattern struct {
		name     string
		patterns []string
	}

	lower := strings.ToLower(bundle)
	candidates := []packagePattern{
		{name: "react", patterns: []string{"node_modules/react/", "react.production.min.js"}},
		{name: "react-dom", patterns: []string{"node_modules/react-dom/", "react-dom.production.min.js"}},
		{name: "@blocknote/core", patterns: []string{"node_modules/@blocknote/core/"}},
		{name: "@blocknote/react", patterns: []string{"node_modules/@blocknote/react/"}},
		{name: "yjs", patterns: []string{"node_modules/yjs/", "yjs was already imported"}},
	}

	found := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		for _, pattern := range candidate.patterns {
			if strings.Contains(lower, strings.ToLower(pattern)) {
				found = append(found, candidate.name)
				break
			}
		}
	}
	sort.Strings(found)
	return found
}

func normalizeStringList(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(strings.ToLower(value))
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	sort.Strings(result)
	return result
}

func containsString(values []string, target string) bool {
	needle := strings.TrimSpace(strings.ToLower(target))
	for _, value := range values {
		if strings.TrimSpace(strings.ToLower(value)) == needle {
			return true
		}
	}
	return false
}
