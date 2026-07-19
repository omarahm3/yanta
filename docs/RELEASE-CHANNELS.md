# Release Channels: Research & Plan for YANTA

_How production desktop apps ship canary/beta/stable, and a concrete plan to add
the same to YANTA (Wails v3 + Go + GitHub Actions)._

---

## TL;DR

- **Channels** = parallel release trains at different stability/cadence tiers.
  The industry-standard set is **Stable → Beta → Canary/Nightly** (Chrome adds a
  weekly "Dev" tier between Beta and Canary; most apps ship 3).
- Each channel is a **separate install** with its own identity (name, icon, app
  ID, data dir) so a user can run Canary next to Stable — this is the single most
  important design decision (VS Code Insiders, Chrome Canary, Discord Canary all
  do this).
- Version numbers carry the channel via **SemVer pre-release tags**:
  `1.4.0` (stable), `1.4.0-beta.2` (beta), `1.4.0-nightly.20260718+abc1234` (canary).
- **CI trigger per channel**: stable/beta = git tag push; canary/nightly =
  scheduled cron (+ manual dispatch). Each publishes a GitHub Release with the
  `prerelease` flag set for non-stable.
- **Auto-update is the hard part**: each channel needs its own update feed, and
  the app must only see updates *within its own channel*. Good news — **Wails v3
  ships a native updater (`pkg/updater`) with first-class channel support**, a
  GitHub provider, ed25519 signature pinning, and delta (bsdiff) patches. YANTA
  should use it rather than rolling its own.

---

## 1. How the big players do it

| App | Channels | Cadence | Coexist install? | Feed model |
|-----|----------|---------|------------------|------------|
| **Chrome / Edge** | Stable, (Extended Stable), Beta, Dev, Canary | Stable ~4wk (→2wk), Beta ~weekly, Dev weekly, Canary **daily** | Canary yes (separate); Beta/Dev replace | Omaha update server keyed by channel GUID |
| **VS Code** | Stable, **Insiders** | Stable monthly, Insiders **nightly** | Yes — separate app ("Visual Studio Code - Insiders"), own icon/data dir | update.code.visualstudio.com, `?build=insider` vs `stable` |
| **Firefox** | Release, Beta, Dev Edition, **Nightly** | Release ~4wk, Beta weekly, Nightly **1–2×/day** | Yes (separate profiles/apps) | Balrog channel-aware server |
| **Discord** | Stable, PTB, **Canary** | Canary near-daily | Yes — 3 separate apps | Per-channel host manifest |
| **Android** | Stable, Beta, Canary | Canary continuous | n/a | Play channel tracks |

**Recurring principles**
1. **Progressive funnel** — code flows Canary → Beta → Stable, each tier a wider,
   more risk-averse audience. Chrome enterprise guidance: ~95% Stable, ~5% Beta,
   Canary for no production use.
2. **Canary is throwaway & isolated** — daily/auto, coexists with Stable, users
   accept breakage. It's your early-warning system.
3. **Channel identity is baked into the build** — name, icon, bundle/app ID, data
   directory, and the update feed all differ, so channels never collide.
4. **Same commit, different train** — a nightly is just "current `main` built and
   published now"; a beta is "a release candidate"; stable is "a blessed tag."

---

## 2. The building blocks of a channel workflow

### 2.1 Channel taxonomy (pick 3)
- **stable** — tagged, hand-blessed, the default download. Slowest.
- **beta** — release candidates ahead of stable; opt-in testers. Weekly-ish.
- **canary/nightly** — automated build of `main`/`develop`; bleeding edge, may
  break. Daily or per-merge.

(YANTA doesn't need Chrome's 5 tiers. Stable + Beta + Nightly covers it.)

### 2.2 Versioning — SemVer pre-release identifiers
SemVer §9/§11: anything after a `-` is a pre-release and sorts **below** the
same core version. This is exactly what channels need.

```
1.4.0                          stable
1.4.0-beta.1, 1.4.0-beta.2     beta   (rc for 1.4.0)
1.4.0-nightly.20260718+ab12cd  nightly (build metadata after + is ignored in precedence)
```

Precedence: `1.4.0-beta.1 < 1.4.0-beta.2 < 1.4.0-rc.1 < 1.4.0`. So a nightly never
"updates over" a stable of the same core version, and beta testers get RCs before
the stable drops. This is the mechanism the updater uses to decide "is there
something newer *on my channel*."

### 2.3 Branch + trigger strategy
| Channel | Trigger | Produces |
|---------|---------|----------|
| stable | push tag `v1.4.0` | GitHub Release, `prerelease:false` |
| beta | push tag `v1.4.0-beta.2` | GitHub Release, `prerelease:true` |
| nightly | `schedule:` cron nightly + `workflow_dispatch` | one **rolling** prerelease (tag `nightly`) re-pointed each night, or dated tags |

Nightly best practice (from GitHub Actions ecosystem): a single rolling
`nightly` release that gets deleted+recreated (or updated) each run, named
`Nightly YYYYMMDD`, `prerelease:true`, so the feed always has exactly one "latest
nightly" and old ones don't pile up. Actions like `andelf/nightly-release` /
`viperproject/create-nightly-release` encapsulate the delete-old-prerelease dance.

### 2.4 CI/CD artifact conventions
- **Name assets by channel** so a feed/user can tell them apart:
  `yanta_1.4.0-beta.2_windows_amd64.exe`, or prefix (`BETA.yanta_...`) as Tauri
  docs suggest. YANTA already embeds version into artifact filenames.
- **Set the GitHub `prerelease` flag** for beta/nightly (YANTA already does:
  `prerelease: ${{ contains(github.ref_name, '-') }}`).
- **Build once per channel** — the only build-time difference is the injected
  version string and (for a coexisting install) the channel identity constants.

### 2.5 Auto-update feeds per channel — the crux
The app must only be offered updates **on its own channel**. Two common models:

- **Dynamic endpoint per channel** (Tauri): build the feed URL from the running
  channel, e.g. `https://{channel}.example.com/{target}-{arch}/{current_version}`.
  Server returns the latest for that channel.
- **One feed, channel-aware filtering** (Wails GitHub provider): point at the
  GitHub repo; a *stable* install queries `/releases/latest` (skips prereleases),
  a *beta/nightly* install walks `/releases` and takes the newest **matching its
  channel** by SemVer. No server to run.

**Static JSON manifest** (Tauri's format — a good template if you ever self-host):
```json
{
  "version": "1.4.0-beta.2",
  "notes": "…",
  "pub_date": "2026-07-18T00:00:00Z",
  "platforms": {
    "windows-x86_64": { "url": "https://…/yanta_1.4.0-beta.2_x64.exe", "signature": "…" },
    "darwin-aarch64": { "url": "https://…", "signature": "…" },
    "linux-x86_64":   { "url": "https://…", "signature": "…" }
  }
}
```

### 2.6 In-app channel switch + telemetry
- Let users change channel in Settings (writes a per-user pref); the updater reads
  it and swaps feeds. Switching *up* (stable→beta) updates immediately; switching
  *down* usually waits until stable catches up (or offers a one-time downgrade).
- **Report the channel** in crash reports / logs / user-agent so you can bucket
  telemetry ("crash rate on canary vs stable"). Bake the channel into the version
  string so it's always visible in About/logs.

### 2.7 Signing & trust (two separate layers)
1. **Update-payload signature** — the updater verifies the downloaded binary
   against a **pinned public key** before swapping. ed25519 is the norm (Wails and
   Tauri both use it; Tauri makes it mandatory). Private key lives in a CI secret;
   public key is compiled into the app. This is independent of OS code signing and
   protects even if the download host is compromised.
2. **OS code signing / notarization** — Windows Authenticode, macOS
   Developer-ID + notarization, Linux (none required). Beta/canary still need this
   or users hit SmartScreen/Gatekeeper. Nightly/canary are often self-signed or
   unsigned with a clear "expect warnings" note — but signing all channels is best.

### 2.8 Rollout %, kill switch, rollback
- **Staged rollout**: release to N% of a channel, watch crash rate, ramp to 100%.
  (Overkill for YANTA now; note for later.)
- **Kill switch / pinning**: ability to stop offering a bad update and re-point
  the feed to the previous good build. With the rolling-nightly + GitHub model,
  "rollback" = delete the bad release; the updater falls back to the prior one.
- **Downgrade protection**: SemVer precedence already prevents a nightly from
  clobbering a newer stable.

---

## 3. Concrete plan for YANTA (Wails v3)

YANTA already has 80% of the plumbing: tag-triggered releases, a reusable
`build-release.yml`, prerelease auto-flagging, multi-platform packaging, and the
`production` build tag (just added) that hardens every channel.

### 3.1 Channels
`stable`, `beta`, `nightly`. Nightly coexists with stable as a separate install.

### 3.2 Versioning
- stable: `v1.4.0` (existing flow)
- beta: `v1.4.0-beta.N` (existing flow — already flagged prerelease)
- nightly: `v0.0.0-nightly.YYYYMMDD+<sha>` **or** a rolling `nightly` tag.
  `internal/system.BuildVersion` already carries this; add the channel too.

### 3.3 Triggers (GitHub Actions)
- **stable/beta**: unchanged — `release.yml` on `push: tags: v*`. It already sets
  `prerelease: contains(ref_name,'-')`, so beta tags are handled today.
- **nightly**: new `nightly.yml`:
  ```yaml
  on:
    schedule: [{ cron: '0 3 * * *' }]   # 03:00 UTC daily
    workflow_dispatch:
  ```
  → call `build-release.yml` with `version: 0.0.0-nightly.<date>+<sha>` →
  publish/replace a single rolling `nightly` prerelease. Skip the run if there
  were no commits since the last nightly (cheap `git log` guard).

### 3.4 Wire the Wails updater (`pkg/updater` + GitHub provider)
```go
import (
    "github.com/wailsapp/wails/v3/pkg/updater"
    ghp "github.com/wailsapp/wails/v3/pkg/updater/providers/github"
)

prov, _ := ghp.New(ghp.Config{
    Repository: "omarahm3/yanta",
    Prerelease: channel != "stable", // stable→/releases/latest; beta+nightly→walk prereleases
})
app.Updater.Init(&updater.Config{
    CurrentVersion: system.BuildVersion, // "1.4.0-beta.2"
    Providers:      []updater.Provider{prov},
    PublicKey:      updaterPublicKey,    // pinned ed25519 key, compiled in
    Channel:        channel,             // "stable" | "beta" | "nightly"
    CheckInterval:  6 * time.Hour,
})
```
- **Channel source**: a build-tag/ldflags constant (like the new `isProductionBuild`)
  **plus** a user override in Settings. Default = the channel the build was
  produced for.
- **Signing**: generate an ed25519 keypair; private key → GitHub Actions secret,
  sign each artifact in `build-release.yml`; public key → `updaterPublicKey`
  compiled into the app. The updater `fail-closed` rejects unsigned/mismatched
  payloads.
- **Channel filtering nuance**: `Prerelease:true` walks *all* prereleases, so a
  beta install could see a `nightly`. Constrain by matching the SemVer
  pre-release identifier to the install's channel (`-beta.` vs `-nightly.`) when
  selecting a release, or run nightly out of a separate feed/repo if you want hard
  isolation.

### 3.5 Coexisting installs (channel identity)
Give each channel distinct constants so Nightly installs beside Stable (YANTA
already isolates data via `YANTA_HOME`; extend it per channel):
| Constant | stable | beta | nightly |
|----------|--------|------|---------|
| App name | YANTA | YANTA Beta | YANTA Nightly |
| App/bundle ID | com.yanta.app | com.yanta.beta | com.yanta.nightly |
| Data dir (`YANTA_HOME`) | `~/.yanta` | `~/.yanta-beta` | `~/.yanta-nightly` |
| Icon | normal | beta badge | canary badge |
| Single-instance ID | per channel | per channel | per channel |

Drive these from the same channel constant, set via ldflags in the build task —
one more `-X` alongside the existing `BuildVersion`/`BuildCommit`/`BuildDate`.

### 3.6 Signing status per platform (current gaps)
- **Windows**: NSIS installer + MSIX (MSIX currently **unsigned** — Store re-signs;
  direct-download beta/canary users get SmartScreen). Add Authenticode for a clean
  beta/canary UX.
- **macOS**: DMG exists; needs Developer-ID signing + **notarization** or Gatekeeper
  blocks beta/canary. (See `docs/RELEASE-MACOS.md`.)
- **Linux**: tarball/deb/Arch — no signing required; updater's ed25519 sig covers
  integrity.

---

## 4. Rollout order (smallest useful increments)

1. **Nightly workflow** (cron → rolling `nightly` prerelease). Pure CI, ships
   value immediately, no app change. ✅ start here.
2. **Channel constant via ldflags** (`stable|beta|nightly`) baked into the binary
   + shown in About/logs.
3. **Wire `pkg/updater`** with the GitHub provider (stable: latest-only; beta/
   nightly: prereleases), behind a feature flag.
4. **ed25519 signing** in CI + pinned public key. (Do before promoting the updater
   to on-by-default.)
5. **Coexisting channel identity** (name/ID/data dir/icon) so Nightly installs
   beside Stable.
6. **In-app channel switcher** in Settings.
7. Later: OS code signing/notarization for beta/canary, staged rollout %, kill
   switch.

---

## Sources
- [Chrome release channels (Chromium)](https://www.chromium.org/getting-involved/chrome-release-channels/) ·
  [Chrome Enterprise channels](https://support.google.com/chrome/a/answer/9027636?hl=en) ·
  [What are Chrome release channels (Chrome for Developers)](https://developer.chrome.com/docs/web-platform/chrome-release-channels)
- [Android Canary channel](https://developer.android.com/about/canary)
- [Release Channels: Beta, Stable, LTS (Medium)](https://medium.com/beyond-the-brackets/release-channels-beta-stable-and-long-term-support-lts-dc971742b122)
- [Wails v3 Auto-Updates guide](https://v3alpha.wails.io/guides/distribution/auto-updates/) ·
  Wails v3 `pkg/updater` source (bundled in the Go module: `Config.Channel`, GitHub/appcast/keygen providers, ed25519 signing, bsdiff deltas)
- [Tauri v2 Updater plugin](https://v2.tauri.app/plugin/updater/) ·
  [tauri-docs updater.mdx (channels, static JSON manifest, signing)](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/plugin/updater.mdx) ·
  [Tauri: different update channels (#2595)](https://github.com/tauri-apps/tauri/issues/2595)
- [andelf/nightly-release action](https://github.com/andelf/nightly-release) ·
  [viperproject/create-nightly-release](https://github.com/viperproject/create-nightly-release) ·
  [microsoft/github-actions-for-desktop-apps](https://github.com/microsoft/github-actions-for-desktop-apps)
- [SemVer spec (pre-release precedence)](https://semver.org/)
