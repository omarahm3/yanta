# macOS code-signing & notarization (YANA-14, goal G4)

YANTA's macOS release is distributed as a `.dmg`. For the `.dmg` to open on a
clean Mac **with no Gatekeeper warning**, the app must be:

1. signed with a **Developer ID Application** certificate under the Hardened
   Runtime,
2. **notarized** by Apple's notary service, and
3. **stapled** so the notarization ticket travels with the `.dmg` offline.

The pipeline does all three automatically when the required secrets are present.
Without them it still builds an **unsigned** `.dmg` (which *will* trip
Gatekeeper) so PRs and forks keep building.

## Pipeline pieces

| File | Role |
| --- | --- |
| `build/scripts/macos-sign-notarize.sh` | Signs the app, builds the `.dmg`, notarizes, staples, verifies. |
| `build/darwin/entitlements.plist` | Hardened-Runtime entitlements (WebKit JIT, library loading). |
| `build/release/Taskfile.yml` → `macos:dmg` | Invokes the script as part of `task release:macos`. |
| `.github/workflows/build-release.yml` | Passes the secrets and uploads the `macos-dmg` artifact. |

## Required GitHub Actions secrets

Set these in **Settings → Secrets and variables → Actions** (repository or
organization). All six are required for a signed+notarized build; if any is
missing the build produces an unsigned `.dmg`.

| Secret | What it is |
| --- | --- |
| `MACOS_CERTIFICATE` | base64 of the exported **Developer ID Application** cert + private key as a `.p12`. |
| `MACOS_CERTIFICATE_PWD` | Password set when exporting the `.p12`. |
| `MACOS_SIGN_IDENTITY` | Full identity string, e.g. `Developer ID Application: ACME Inc (AB12CD34EF)`. |
| `MACOS_NOTARY_APPLE_ID` | Apple ID email of an account on the Developer team. |
| `MACOS_NOTARY_TEAM_ID` | 10-character Apple Developer **Team ID**. |
| `MACOS_NOTARY_PASSWORD` | An **app-specific password** for that Apple ID (not the account password). |

### How to produce each value (one-time, account owner)

> These steps need an **Apple Developer Program** membership ($99/yr) and access
> to a Mac with Xcode command-line tools. They can only be done by the account
> owner because they require Apple ID authentication.

1. **Developer ID Application certificate**
   - In Xcode: *Settings → Accounts → Manage Certificates → +
     → Developer ID Application*, or create it at
     <https://developer.apple.com/account/resources/certificates>.
   - Export it from **Keychain Access** (the cert *with* its private key) as
     `cert.p12`, choosing an export password → that password is
     `MACOS_CERTIFICATE_PWD`.
   - Encode for the secret:
     ```sh
     base64 -i cert.p12 | pbcopy      # paste into MACOS_CERTIFICATE
     ```

2. **Signing identity string** — find the exact name:
   ```sh
   security find-identity -v -p codesigning
   # → "Developer ID Application: ACME Inc (AB12CD34EF)"
   ```
   Use the quoted string for `MACOS_SIGN_IDENTITY`; the parenthesized value is
   your `MACOS_NOTARY_TEAM_ID`.

3. **App-specific password** for notarization
   - Sign in at <https://account.apple.com> → *Sign-In and Security →
     App-Specific Passwords → +*.
   - The generated password is `MACOS_NOTARY_PASSWORD`; the Apple ID email is
     `MACOS_NOTARY_APPLE_ID`.

## Verifying the acceptance criterion

The script runs `stapler validate` and `spctl --assess` at the end of a signed
build. To confirm manually on a clean Mac (or one that has never trusted the
cert):

```sh
# After downloading the release dmg:
spctl --assess --type open --context context:primary-signature -v Yanta-*.dmg
# → should print "accepted" and "source=Notarized Developer ID"

# Mount, then check the app itself:
codesign --verify --deep --strict --verbose=2 /Volumes/YANTA/yanta.app
xcrun stapler validate /Volumes/YANTA/yanta.app
```

A double-click that opens the app **without** the "cannot be opened because the
developer cannot be verified" dialog is the pass condition for YANA-14.

## Local signed build (optional)

With the cert already in your login keychain you can run:

```sh
MACOS_SIGN_IDENTITY="Developer ID Application: ACME Inc (AB12CD34EF)" \
MACOS_NOTARY_APPLE_ID="you@example.com" \
MACOS_NOTARY_TEAM_ID="AB12CD34EF" \
MACOS_NOTARY_PASSWORD="app-specific-pw" \
MACOS_CERTIFICATE="(base64 p12)" MACOS_CERTIFICATE_PWD="(p12 pw)" \
task release:macos
```

Omit the `MACOS_*` variables to get a fast unsigned `.dmg` for local testing.
