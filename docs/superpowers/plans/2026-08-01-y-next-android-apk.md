# Y-next Android APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een echte, ondertekende Android-APK van Y-next bouwen via GitHub Actions, zonder lokale Java/Android-toolchain, die de bestaande productiesite `https://open-aec-studio-erp.prilk.cloud/y-next` opent in de Android system-webview met behoud van de ERPNext-sessiecookie.

**Gekozen route: A — Tauri-webview-wrapper om de live site.** Route B (volledige Tauri-bundel van de Y-next-frontend + directe API-calls) is afgewezen: zie "Afweging A vs B" hieronder.

**Architecture:** Nieuw, minimaal Tauri 2-project onder `packages/android/`, los van `packages/desktop/`. De hoofdwindow laadt de externe URL `https://open-aec-studio-erp.prilk.cloud/y-next` direct als `windows[0].url` in `tauri.conf.json` — geen embedded frontend-build, geen IPC-brug naar de pagina. De enige noodzakelijke Rust is een `on_navigation`-hook die niet-ERPNext-domeinen naar de systeembrowser stuurt. CI (nieuwe workflow `android-apk.yml`) installeert Java 17 + Android SDK/NDK, draait `tauri android build`, ondertekent de APK met een keystore uit repo-secrets, en publiceert 'm als workflow-artifact.

**Tech Stack:** Tauri 2 (Rust, minimale crate), Android SDK/NDK via GitHub Actions, systeem-WebView (Chromium via Android WebView component), bestaande productie-Y-next-site (geen buildstap voor de content zelf).

## Global Constraints

- Werk uitsluitend in `C:\Users\rickd\Documents\GitHub\Y-app-ERPNext`, branch `codex/y-next-architecture` (nog niet gepusht — pushen is stap 1 van de gebruikerslijst).
- Geen wijzigingen aan `packages/desktop/` — dat blijft de bewaarde, niet-gedeployde multi-instance Tauri-app (zie README §"packages/server en packages/desktop"). Niet hergebruiken voor deze track.
- Geen wijzigingen aan de ERPNext-architectuur: geen CORS-uitzonderingen, geen credential-vault, geen eigen backend — conform `docs/superpowers/specs/2026-07-29-y-next-architecture-design.md` besluit 6 ("frontend op hetzelfde domein... geen CORS-uitzonderingen nodig").
- Lokaal is er geen Java/Android SDK — alle Android-tooling draait uitsluitend in CI (GitHub Actions).
- Geen secrets in code, git-historie of workflow-logs. Keystore alleen als base64 repo-secret.
- Nieuwe workflow is `workflow_dispatch`-only (geen automatische trigger op push/PR) — bewust een losstaande, goedkope build-on-demand, net als het bestaande patroon in `test-build.yml`.

---

## Afweging A vs B

### Route B (volledige Tauri-bundel + directe API-calls) — afgewezen

- Y-next's architectuurbesluit is expliciet same-origin: de browser/webview draait op hetzelfde domein als ERPNext zodat sessiecookies gewoon meegaan, en er zijn bewust GEEN CORS-uitzonderingen (design-doc besluit 6). Een Tauri-app met embedded dist draait op een ander origin (`tauri://localhost` / `https://tauri.localhost`), dus:
  - ERPNext-sessiecookies (Set-Cookie bij `/login`) worden nooit naar dat andere origin gestuurd — geen CORS-header lost dit op, want cookies zijn origin-gebonden, niet request-gebonden. Dit zou vereisen dat ERPNext zelf wordt omgebouwd (CORS + `SameSite=None` cookies + credentials-mode), wat het architectuurbesluit "geen CORS-uitzonderingen" direct doorbreekt.
  - `packages/desktop/src/adapter/fetch.ts` (de enige bestaande referentie voor "praat rechtstreeks met een API vanuit Tauri") is niet herbruikbaar: het is een IPC-brug naar Rust-`invoke`-commands die op hun beurt een Stronghold-vault met per-instance ERPNext-credentials aanspreken (`getCredsForInstance`, `getAllCredentials`), plus NextCloud Talk-credentials en gedeelde types met `packages/server`. Dat hele credential-model bestaat in Y-next niet meer (single-tenant, sessie-login, geen vault — README: "Geen Express-productieserver en geen credential-vault... in deze fork niet van toepassing").
  - Conclusie: Route B is voor Y-next niet goedkoop of betrouwbaar te maken zonder architectuur-inbreuk. Afgewezen.

### Route A (webview-wrapper) — gekozen

- Y-next is al een normale, publiek bereikbare webpagina (`/y-next`, ERPNext Web Page) met bestaande sessie-/loginflow (`docs/deployment.md`: "een niet-ingelogde bezoeker krijgt een loginkaart"). Een webview die gewoon die URL laadt gedraagt zich identiek aan een mobiele browser-tab: cookies zijn same-origin voor het echte productiedomein, geen wijziging aan ERPNext nodig.
- Zeer weinig Rust: geen commands, geen vault, geen plugins buiten wat voor navigatie nodig is.
- Volledig herbouwbaar/herhaalbaar in CI zonder lokale toolchain.
- Trade-off die je accepteert: geen offline-modus, geen custom foutscherm bij netwerkuitval (toont de WebView-eigen fout-pagina), geen diepere OS-integratie (biometrics, notificaties) — voor "goedkoopste betrouwbare route naar een APK" is dat een aanvaardbare eerste stap; kan later alsnog met een eigen `initialization_script`/error-handler worden verfijnd.

---

## Bestandsstructuur na deze track

```text
Y-app-ERPNext/
├─ packages/android/                       # NIEUW — los van packages/desktop
│  ├─ package.json                         # alleen @tauri-apps/cli als devDependency
│  ├─ web/
│  │  └─ index.html                        # triviale placeholder (frontendDist-vereiste; nooit echt getoond)
│  └─ src-tauri/
│     ├─ Cargo.toml                        # minimale crate: tauri + tauri-plugin-shell
│     ├─ build.rs                          # standaard tauri-build passthrough
│     ├─ tauri.conf.json                   # windows[0].url = live productie-URL
│     ├─ capabilities/
│     │  └─ default.json                   # core:default + shell:allow-open (system browser voor externe links)
│     ├─ icons/                            # gegenereerd met `tauri icon` uit y-logo.svg/icon.png
│     └─ src/
│        ├─ main.rs                        # standaard entrypoint
│        └─ lib.rs                         # on_navigation-hook: ERPNext-domein toestaan, rest naar systeembrowser
└─ .github/workflows/
   └─ android-apk.yml                      # NIEUW — workflow_dispatch, artifact-only
```

`packages/android/` wordt NIET toegevoegd aan de root `workspaces`-array in `package.json` (zelfde patroon als `packages/desktop`, dat ook los staat met eigen `package-lock.json`).

---

### Task 1: Nieuw minimaal Tauri-Android-project onder `packages/android/`

**Files:**
- Create: `packages/android/package.json`
- Create: `packages/android/web/index.html`
- Create: `packages/android/src-tauri/Cargo.toml`
- Create: `packages/android/src-tauri/build.rs`
- Create: `packages/android/src-tauri/tauri.conf.json`
- Create: `packages/android/src-tauri/capabilities/default.json`
- Create: `packages/android/src-tauri/src/main.rs`
- Create: `packages/android/src-tauri/src/lib.rs`
- Copy: een 1024×1024 bronicoon (bv. gebaseerd op `packages/frontend/public/y-logo.svg` of hergebruik `packages/desktop/src-tauri/icons/icon.png`) naar `packages/android/src-tauri/icons/icon.png` — `tauri icon` genereert de rest in CI.

**Interfaces:**
- Consumes: niets van `packages/frontend` of `packages/desktop` — volledig losstaand.
- Produces: een Tauri-project dat `npx tauri android build --apk --target aarch64` accepteert.

- [ ] **Step 1: `packages/android/package.json`**

```json
{
  "name": "@y-app/android",
  "private": true,
  "version": "0.1.0",
  "devDependencies": {
    "@tauri-apps/cli": "^2.10.1"
  }
}
```

Geen React/Vite/frontend-dependencies — er wordt niets gebundeld, de content komt live van het net.

- [ ] **Step 2: `packages/android/web/index.html`** (triviale placeholder, vereist door Tauri's `build.frontendDist`, wordt in de praktijk nooit getoond omdat `windows[0].url` direct naar de live site wijst)

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Y-next</title></head>
<body>Loading Y-next…</body></html>
```

- [ ] **Step 3: `packages/android/src-tauri/Cargo.toml`** — bewust minimaal, GEEN Stronghold/IMAP/SMTP/rusqlite/biometric zoals in `packages/desktop/src-tauri/Cargo.toml`:

```toml
[package]
name = "y-next-android"
version = "0.1.0"
edition = "2021"

[lib]
name = "y_next_android_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2" }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[profile.release]
strip = true
lto = true
codegen-units = 1
opt-level = "s"
panic = "abort"
```

- [ ] **Step 4: `packages/android/src-tauri/build.rs`** — standaard:

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 5: `packages/android/src-tauri/tauri.conf.json`** — de kern van route A: de window laadt de externe productie-URL rechtstreeks.

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "Y-next",
  "version": "0.1.0",
  "identifier": "foundation.openaec.y-next",
  "build": {
    "frontendDist": "../web"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Y-next",
        "url": "https://open-aec-studio-erp.prilk.cloud/y-next"
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["apk"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png"
    ]
  }
}
```

Let op: `url` als volledige `https://`-string is een officieel ondersteunde Tauri-2-feature ("wrap een website"). Er is bewust GEEN `dangerousRemoteDomainIpcAccess` — de geladen ERPNext-pagina krijgt dus GEEN toegang tot Tauri-commands/IPC. Dat is een bewuste security-keuze: zonder deze toegang kan een eventuele XSS op de ERPNext-site nooit native Tauri-functionaliteit aanroepen.

- [ ] **Step 6: `packages/android/src-tauri/capabilities/default.json`**

```json
{
  "identifier": "default",
  "description": "Minimale capabilities voor de Y-next Android-webview-wrapper.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 7: `packages/android/src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    y_next_android_lib::run();
}
```

- [ ] **Step 8: `packages/android/src-tauri/src/lib.rs`** — het enige stukje "ombouw": sta navigatie binnen het ERPNext-domein toe, stuur al het andere naar de systeembrowser (voorkomt dat externe links — bv. bijlage-downloads met een ander domein, Wiki-externe links, OAuth-doorverwijzingen — vast komen te zitten in de app-webview zonder adresbalk of terugknop-context).

```rust
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

const ALLOWED_HOST: &str = "open-aec-studio-erp.prilk.cloud";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_navigation(move |url| {
                    let is_allowed = url.host_str() == Some(ALLOWED_HOST);
                    if !is_allowed {
                        let _ = handle.shell().open(url.to_string(), None);
                    }
                    is_allowed
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 9: Icoon voorbereiden** — zet een 1024×1024 PNG (afgeleid van `packages/frontend/public/y-logo.svg`, of tijdelijk hergebruik van `packages/desktop/src-tauri/icons/icon.png`) op `packages/android/src-tauri/icons/icon.png`. CI genereert de rest via `npx tauri icon`.

---

### Task 2: Nieuwe GitHub Actions workflow `android-apk.yml`

**Files:**
- Create: `.github/workflows/android-apk.yml`

**Interfaces:**
- Consumes: `packages/android/**`, repo-secrets `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS`.
- Produces: workflow-artifact `y-next-android-apk` met een ondertekende APK.

Bewust een NIEUWE, losstaande workflow in plaats van het android-blok in het bestaande `release.yml` uit te breiden: `release.yml` is een zware multi-platform pipeline (Windows/macOS/Linux + Azure Trusted Signing voor `packages/desktop`) die niet zou moeten falen/wachten op een Windows-Authenticode-secret om alleen een Android-testbuild te krijgen. Wel wordt het beproefde sign-blok (Java 17, SDK/NDK-setup, keystore-decode, zipalign+apksigner) vrijwel 1-op-1 gekopieerd uit `release.yml`'s `build-android`-job, aangepast naar `packages/android` i.p.v. `packages/desktop`.

- [ ] **Step 1: Workflow-skelet**

```yaml
name: Android APK (Y-next)

on:
  workflow_dispatch: {}

concurrency:
  group: android-apk
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Setup Java JDK 17
        uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "17"

      - name: Setup Android SDK
        uses: android-actions/setup-android@v4

      - name: Install Android NDK
        run: sdkmanager --install "ndk;27.0.12077973"

      - uses: actions/setup-node@v5
        with:
          node-version: "20"

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-linux-android

      - name: Cache Rust build artifacts
        uses: actions/cache@v5
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            packages/android/src-tauri/target
          key: android-apk-rust-${{ hashFiles('packages/android/src-tauri/Cargo.lock') }}
          restore-keys: android-apk-rust-

      - name: Install Tauri CLI
        working-directory: packages/android
        run: npm install --no-save

      - name: Initialize Android project
        working-directory: packages/android
        run: npx tauri android init
        env:
          NDK_HOME: ${{ env.ANDROID_HOME }}/ndk/27.0.12077973

      - name: Generate app icons for Android
        working-directory: packages/android
        run: npx tauri icon src-tauri/icons/icon.png

      - name: Build Android APK
        working-directory: packages/android
        run: npx tauri android build --apk --target aarch64
        env:
          NDK_HOME: ${{ env.ANDROID_HOME }}/ndk/27.0.12077973

      - name: Decode Android signing keystore
        env:
          ANDROID_KEYSTORE_B64: ${{ secrets.ANDROID_KEYSTORE_B64 }}
        run: |
          if [ -z "$ANDROID_KEYSTORE_B64" ]; then
            echo "::error::ANDROID_KEYSTORE_B64 secret ontbreekt. Zie docs/superpowers/plans/2026-08-01-y-next-android-apk.md voor het aanmaken van een keystore."
            exit 1
          fi
          echo "$ANDROID_KEYSTORE_B64" | base64 -d > "$RUNNER_TEMP/y-next-release.jks"

      - name: Sign APK
        working-directory: packages/android
        env:
          KEYSTORE_PASS: ${{ secrets.ANDROID_KEYSTORE_PASS }}
          KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
        run: |
          UNSIGNED_APK=$(find src-tauri/gen/android -name "*-unsigned.apk" -type f | head -1)
          if [ -z "$UNSIGNED_APK" ]; then
            echo "No unsigned APK found"
            exit 1
          fi
          APK_DIR=$(dirname "$UNSIGNED_APK")
          BUILD_TOOLS=$(ls -d $ANDROID_HOME/build-tools/*/ | sort -V | tail -1)

          ALIGNED_APK="$APK_DIR/y-next-aligned.apk"
          "${BUILD_TOOLS}zipalign" -v 4 "$UNSIGNED_APK" "$ALIGNED_APK"

          SIGNED_APK="$APK_DIR/y-next-release.apk"
          "${BUILD_TOOLS}apksigner" sign \
            --ks "$RUNNER_TEMP/y-next-release.jks" \
            --ks-key-alias "$KEY_ALIAS" \
            --ks-pass "pass:$KEYSTORE_PASS" \
            --key-pass "pass:$KEYSTORE_PASS" \
            --out "$SIGNED_APK" \
            "$ALIGNED_APK"

          "${BUILD_TOOLS}apksigner" verify --verbose "$SIGNED_APK"

      - name: Cleanup keystore
        if: always()
        run: rm -f "$RUNNER_TEMP/y-next-release.jks"

      - name: Upload APK artifact
        uses: actions/upload-artifact@v7
        with:
          name: y-next-android-apk
          path: packages/android/src-tauri/gen/android/**/y-next-release.apk
          if-no-files-found: error
```

Bewust artifact-only (net als `test-build.yml`), GEEN GitHub Release-publicatie — dat is een latere, aparte beslissing zodra er een echte releasecadans voor Y-next is.

---

### Task 3: Secrets die de gebruiker moet aanmaken

- [ ] **Step 1: Nieuwe release-keystore genereren** (eenmalig, lokaal, met een JDK die `keytool` heeft — niet per se dezelfde als de Y-app-keystore, want ander app-`identifier` `foundation.openaec.y-next`):

```powershell
keytool -genkeypair -v -keystore y-next-release.jks -alias y-next -keyalg RSA -keysize 2048 -validity 10000
```

Bewaar `y-next-release.jks` en het gekozen wachtwoord permanent en veilig (bv. wachtwoordmanager) — verlies betekent dat een volgende signing-sleutel niet meer over een geïnstalleerde APK heen kan updaten (Android weigert dat).

- [ ] **Step 2: Base64-coderen en als GitHub-secrets aanmaken** (repo → Settings → Secrets and variables → Actions):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("y-next-release.jks")) | Set-Clipboard
```

  - `ANDROID_KEYSTORE_B64` — geplakte base64-inhoud van `y-next-release.jks`.
  - `ANDROID_KEYSTORE_PASS` — het keystore/key-wachtwoord van Stap 1.
  - `ANDROID_KEY_ALIAS` — `y-next` (of het gekozen alias).

---

### Task 4: Verificatie

- [ ] **Step 1:** Push de branch `codex/y-next-architecture` naar de remote (nog niet gepusht).
- [ ] **Step 2:** Maak de 3 secrets aan (Task 3).
- [ ] **Step 3:** Trigger de workflow handmatig: Actions → "Android APK (Y-next)" → Run workflow.
- [ ] **Step 4:** Download het `y-next-android-apk`-artifact van de voltooide run, pak uit, installeer op een testtoestel (Onbekende bronnen/"Install unknown apps" toestaan).
- [ ] **Step 5:** Handmatige smoke-test op het toestel:
  - App opent en toont de ERPNext-login of, indien al ingelogd in de systeem-WebView-cookiestore, direct `/y-next`.
  - Log in; sluit de app volledig af (uit recents vegen) en heropen — sessie moet nog actief zijn (WebView-cookiepersistentie, geen extra actie nodig).
  - Navigeer een paar niveaus diep (bv. Instellingen → een submodule) en druk op de hardware/gebaar-terugknop — verwacht: navigeert terug in de webview-historie, verlaat de app niet meteen. Als dit niet het geval blijkt, is een expliciete `on_navigation`/`window.eval("history.back()")`-koppeling aan de Android back-event nodig als vervolgstap (niet in scope van dit plan totdat het probleem bevestigd is).
  - Klik een link die duidelijk buiten `open-aec-studio-erp.prilk.cloud` valt (bv. een externe wiki-link) — verwacht: opent in de systeembrowser, niet in de app.
  - Zet wifi/mobiele data uit en heropen de app — verwacht: WebView-eigen "geen verbinding"-pagina (bekende MVP-beperking, geen blocker).

---

## Buiten scope van dit plan

- Play Store-publicatie (alleen een side-loadbare, ondertekende APK).
- Offline-modus, custom netwerkfout-scherm, push-notificaties, biometrics.
- Hergebruik of aanpassing van `packages/desktop/` of `packages/server/`.
- Automatische release/versioning-koppeling (semver, GitHub Releases) voor de Android-track — dit is een losse, herhaalbare workflow-dispatch-build.
