package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const signatureFileName = "signature.json"

var skippedDirs = map[string]struct{}{
	".git":         {},
	".keys":        {},
	"node_modules": {},
}

type signaturePayload struct {
	Algorithm   string `json:"algorithm"`
	PublisherID string `json:"publisherId"`
	KeyID       string `json:"keyId"`
	Digest      string `json:"digest"`
	Signature   string `json:"signature"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "keygen":
		runKeygen(os.Args[2:])
	case "sign":
		runSign(os.Args[2:])
	case "-h", "--help", "help":
		printUsage()
	default:
		fatalf("unknown subcommand %q", os.Args[1])
	}
}

func runKeygen(args []string) {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	outDir := fs.String("out", ".keys", "output directory for generated keys")
	_ = fs.Parse(args)

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fatalf("generate ed25519 keypair: %v", err)
	}
	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		fatalf("create output directory %q: %v", *outDir, err)
	}

	publicPath := filepath.Join(*outDir, "public.key")
	privatePath := filepath.Join(*outDir, "private.key")
	if err := os.WriteFile(publicPath, []byte(base64.StdEncoding.EncodeToString(publicKey)), 0o644); err != nil {
		fatalf("write %s: %v", publicPath, err)
	}
	if err := os.WriteFile(privatePath, []byte(base64.StdEncoding.EncodeToString(privateKey)), 0o600); err != nil {
		fatalf("write %s: %v", privatePath, err)
	}

	fmt.Printf("public key: %s\n", publicPath)
	fmt.Printf("private key: %s\n", privatePath)
}

func runSign(args []string) {
	fs := flag.NewFlagSet("sign", flag.ExitOnError)
	pluginDir := fs.String("plugin", "", "plugin directory (contains plugin.toml)")
	privateKeyPath := fs.String("private-key", "", "path to base64 private key file")
	publisherID := fs.String("publisher-id", "", "publisher identifier")
	keyID := fs.String("key-id", "", "signing key identifier")
	_ = fs.Parse(args)

	root := mustPluginDir(*pluginDir)
	if strings.TrimSpace(*privateKeyPath) == "" {
		fatalf("-private-key is required")
	}
	if strings.TrimSpace(*publisherID) == "" {
		fatalf("-publisher-id is required")
	}
	if strings.TrimSpace(*keyID) == "" {
		fatalf("-key-id is required")
	}

	encodedPrivateKey, err := os.ReadFile(*privateKeyPath)
	if err != nil {
		fatalf("read private key: %v", err)
	}
	privateKeyRaw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(encodedPrivateKey)))
	if err != nil {
		fatalf("decode private key: %v", err)
	}
	if len(privateKeyRaw) != ed25519.PrivateKeySize {
		fatalf("private key must be %d raw bytes in base64", ed25519.PrivateKeySize)
	}

	digestHex, err := computeDigest(root)
	if err != nil {
		fatalf("compute digest: %v", err)
	}
	digestBytes, err := hex.DecodeString(digestHex)
	if err != nil {
		fatalf("decode digest: %v", err)
	}
	signature := ed25519.Sign(ed25519.PrivateKey(privateKeyRaw), digestBytes)
	payload := signaturePayload{
		Algorithm:   "ed25519",
		PublisherID: strings.TrimSpace(*publisherID),
		KeyID:       strings.TrimSpace(*keyID),
		Digest:      digestHex,
		Signature:   base64.StdEncoding.EncodeToString(signature),
	}
	encoded, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		fatalf("encode signature payload: %v", err)
	}

	signaturePath := filepath.Join(root, signatureFileName)
	if err := os.WriteFile(signaturePath, encoded, 0o644); err != nil {
		fatalf("write signature: %v", err)
	}
	fmt.Printf("signed: %s\n", signaturePath)
}

func mustPluginDir(raw string) string {
	root := strings.TrimSpace(raw)
	if root == "" {
		fatalf("-plugin is required")
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		fatalf("resolve plugin directory: %v", err)
	}
	info, err := os.Stat(absRoot)
	if err != nil {
		fatalf("stat plugin directory: %v", err)
	}
	if !info.IsDir() {
		fatalf("plugin path must be directory: %s", absRoot)
	}
	manifestPath := filepath.Join(absRoot, "plugin.toml")
	if _, err := os.Stat(manifestPath); err != nil {
		fatalf("missing %s: %v", manifestPath, err)
	}
	return absRoot
}

func computeDigest(root string) (string, error) {
	files, err := collectPluginFiles(root)
	if err != nil {
		return "", err
	}

	hash := sha256.New()
	for _, rel := range files {
		hash.Write([]byte(rel))
		hash.Write([]byte{0})
		content, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			return "", fmt.Errorf("read %s: %w", rel, err)
		}
		hash.Write(content)
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func collectPluginFiles(root string) ([]string, error) {
	files := make([]string, 0, 32)
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if d.IsDir() {
			if _, shouldSkip := skippedDirs[d.Name()]; shouldSkip {
				return filepath.SkipDir
			}
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if rel == "." || strings.HasPrefix(rel, "../") {
			return fmt.Errorf("invalid file outside plugin root: %s", path)
		}
		if rel == signatureFileName {
			return nil
		}
		files = append(files, rel)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}

func printUsage() {
	fmt.Println(`yanta-plugin: Yanta plugin packaging CLI

Usage:
  yanta-plugin <command> [flags]

Commands:
  keygen   Generate publisher keypair
  sign     Sign plugin directory and write signature.json

Examples:
  go run ./cmd/yanta-plugin keygen -out ./my-plugin/.keys
  go run ./cmd/yanta-plugin sign -plugin ./my-plugin -private-key ./my-plugin/.keys/private.key -publisher-id my.publisher -key-id my-key-1`)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
