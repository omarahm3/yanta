package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	defaultBuildEntry = "plugin.ts"
	defaultBuildOut   = "main.js"
	defaultBuildMeta  = "main.meta.json"

	buildMetadataBuilder       = "yanta-plugin-cli"
	buildMetadataBuilderV1     = "v1"
	buildMetadataToolBun       = "bun"
	buildMetadataFormatYantaV1 = "yanta-esm-v1"
)

var hostRuntimeAliases = map[string]string{
	"react":                 "React",
	"react-dom":             "ReactDOM",
	"react-dom/client":      "ReactDOMClient",
	"react/jsx-runtime":     "JSXRuntime",
	"react/jsx-dev-runtime": "JSXDevRuntime",
	"@blocknote/core":       "BlockNoteCore",
	"@blocknote/react":      "BlockNoteReact",
	"yjs":                   "Yjs",
}

var forbiddenBundledPackages = []string{
	"react",
	"react-dom",
	"@blocknote/core",
	"@blocknote/react",
	"yjs",
}

type pluginBuildMetadata struct {
	Builder                 string   `json:"builder"`
	BuilderVersion          string   `json:"builder_version"`
	BuildTool               string   `json:"build_tool"`
	Format                  string   `json:"format"`
	HostExternals           []string `json:"host_externals"`
	DetectedBundledPackages []string `json:"detected_bundled_packages,omitempty"`
	EntryHashSHA256         string   `json:"entry_hash_sha256"`
	GeneratedAt             string   `json:"generated_at"`
}

func runBuild(args []string) {
	fs := flag.NewFlagSet("build", flag.ExitOnError)
	pluginDir := fs.String("plugin", ".", "plugin directory (contains plugin.toml)")
	entry := fs.String("entry", defaultBuildEntry, "plugin source entry relative to -plugin")
	out := fs.String("out", defaultBuildOut, "output bundle path relative to -plugin")
	meta := fs.String("meta", defaultBuildMeta, "metadata output path relative to -plugin")
	_ = fs.Parse(args)

	root := mustPluginDir(*pluginDir)
	entryPath := filepath.Join(root, filepath.Clean(strings.TrimSpace(*entry)))
	outPath := filepath.Join(root, filepath.Clean(strings.TrimSpace(*out)))
	metaPath := filepath.Join(root, filepath.Clean(strings.TrimSpace(*meta)))

	entryInfo, err := os.Stat(entryPath)
	if err != nil {
		fatalf("entry file %q is not accessible: %v", entryPath, err)
	}
	if entryInfo.IsDir() {
		fatalf("entry must be a file: %s", entryPath)
	}

	if err := buildWithBun(root, entryPath, outPath, hostRuntimeAliases); err != nil {
		fatalf("bun build failed: %v", err)
	}

	bundle, err := os.ReadFile(outPath)
	if err != nil {
		fatalf("read bundle output: %v", err)
	}
	hash := sha256.Sum256(bundle)
	bundledForbidden := detectBundledForbiddenPackages(string(bundle))
	if len(bundledForbidden) > 0 {
		_ = os.Remove(metaPath)
		fatalf("bundle contains forbidden host runtime packages: %s", strings.Join(bundledForbidden, ", "))
	}

	if err := os.MkdirAll(filepath.Dir(metaPath), 0o755); err != nil {
		fatalf("create metadata directory: %v", err)
	}

	buildMeta := pluginBuildMetadata{
		Builder:                 buildMetadataBuilder,
		BuilderVersion:          buildMetadataBuilderV1,
		BuildTool:               buildMetadataToolBun,
		Format:                  buildMetadataFormatYantaV1,
		HostExternals:           append([]string(nil), forbiddenBundledPackages...),
		DetectedBundledPackages: bundledForbidden,
		EntryHashSHA256:         hex.EncodeToString(hash[:]),
		GeneratedAt:             time.Now().UTC().Format(time.RFC3339),
	}

	encoded, err := json.MarshalIndent(buildMeta, "", "  ")
	if err != nil {
		fatalf("encode metadata: %v", err)
	}
	if err := os.WriteFile(metaPath, encoded, 0o644); err != nil {
		fatalf("write metadata: %v", err)
	}

	fmt.Printf("built: %s\n", outPath)
	fmt.Printf("metadata: %s\n", metaPath)
}

func buildWithBun(pluginRoot string, entryPath string, outPath string, aliases map[string]string) error {
	if _, err := exec.LookPath("bun"); err != nil {
		return fmt.Errorf("bun is required but was not found in PATH")
	}

	aliasJSON, err := json.Marshal(aliases)
	if err != nil {
		return fmt.Errorf("encode aliases: %w", err)
	}

	buildScript, err := writeTempBunBuildScript()
	if err != nil {
		return fmt.Errorf("write temporary build script: %w", err)
	}
	defer os.RemoveAll(filepath.Dir(buildScript))

	cmd := exec.Command("bun", buildScript, entryPath, outPath, string(aliasJSON))
	cmd.Dir = pluginRoot
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v\n%s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func writeTempBunBuildScript() (string, error) {
	script := `import path from "node:path";

const [entryPath, outPath, aliasJSON] = process.argv.slice(2);
if (!entryPath || !outPath || !aliasJSON) {
  console.error("missing build arguments");
  process.exit(1);
}

const aliases = JSON.parse(aliasJSON);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeShim(moduleID, hostKey) {
  return "const host = globalThis.__YANTA_PLUGIN_HOST__;\n" +
    "if (!host || !host[" + JSON.stringify(hostKey) + "]) {\n" +
    "  throw new Error('Missing YANTA host runtime module: ' + " + JSON.stringify(moduleID) + ");\n" +
    "}\n" +
    "module.exports = host[" + JSON.stringify(hostKey) + "];\n";
}

const aliasPlugin = {
  name: "yanta-host-runtime-alias",
  setup(build) {
    for (const [moduleID, hostKey] of Object.entries(aliases)) {
      const filter = new RegExp("^" + escapeRegExp(moduleID) + "$");
      build.onResolve({ filter }, () => ({ path: moduleID, namespace: "yanta-host" }));
      build.onLoad({ filter, namespace: "yanta-host" }, () => ({
        loader: "js",
        contents: makeShim(moduleID, hostKey),
      }));
    }
  },
};

const result = await Bun.build({
  entrypoints: [entryPath],
  target: "browser",
  format: "esm",
  sourcemap: "none",
  bundle: true,
  write: false,
  plugins: [aliasPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log.message);
  }
  process.exit(1);
}

const base = path.basename(outPath, path.extname(outPath));
const outDir = path.dirname(outPath);
let wroteEntryJS = false;
for (const output of result.outputs) {
  const ext = path.extname(output.path) || ".js";
  const targetPath = path.join(outDir, base + ext);
  await Bun.write(targetPath, await output.arrayBuffer());
  if (ext === ".js") {
    wroteEntryJS = true;
  }
}

if (!wroteEntryJS) {
  console.error("bun build did not produce a JavaScript output");
  process.exit(1);
}
`

	tempDir, err := os.MkdirTemp("", "yanta-plugin-build-*")
	if err != nil {
		return "", err
	}
	path := filepath.Join(tempDir, "build.mjs")
	if err := os.WriteFile(path, []byte(script), 0o600); err != nil {
		_ = os.RemoveAll(tempDir)
		return "", err
	}
	return path, nil
}

func detectBundledForbiddenPackages(bundle string) []string {
	type packagePattern struct {
		name     string
		patterns []*regexp.Regexp
	}

	patterns := []packagePattern{
		{name: "react", patterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)node_modules/react/`),
			regexp.MustCompile(`(?i)react\.production\.min\.js`),
		}},
		{name: "react-dom", patterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)node_modules/react-dom/`),
			regexp.MustCompile(`(?i)react-dom\.production\.min\.js`),
		}},
		{name: "@blocknote/core", patterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)node_modules/@blocknote/core/`),
		}},
		{name: "@blocknote/react", patterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)node_modules/@blocknote/react/`),
		}},
		{name: "yjs", patterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)node_modules/yjs/`),
			regexp.MustCompile(`(?i)Yjs was already imported`),
		}},
	}

	found := make([]string, 0, len(patterns))
	for _, candidate := range patterns {
		for _, pattern := range candidate.patterns {
			if pattern.MatchString(bundle) {
				found = append(found, candidate.name)
				break
			}
		}
	}

	sort.Strings(found)
	return found
}
