# Installing Equity Desk

Equity Desk is a Windows app. It also runs on a Mac through [Wine](https://www.winehq.org), but that setup is **not officially supported**.

Before you start, check [RECOMMENDED-SPECS.md](RECOMMENDED-SPECS.md) to see what speed to expect from the AI assistant on your computer.

- [Windows](#windows)
- [macOS (with Wine)](#macos-with-wine)
- [Optional: local AI with Ollama](#optional-local-ai-with-ollama)
- [Updating and uninstalling](#updating-and-uninstalling)

---

## Windows

**You need:** Windows 10 or 11 (64-bit), 8 GB RAM or more, and about 2 GB of free disk space (plus 10 to 15 GB if you want a local AI model).

### Option A: Installer (recommended)

1. Open the [Releases](../../releases) page and download `EquityDesk-Setup-1.1.0-beta.1.exe`.
   - If your browser blocks the `.exe`, download `EquityDesk-Setup-1.1.0-beta.1.zip` instead and unzip it.
2. Double-click the installer. No administrator rights are needed.
3. If Windows SmartScreen says "Windows protected your PC", click **More info** > **Run anyway**. This appears because the app is not code-signed yet.
4. Accept the licence and choose where to install. The installer adds a Start menu shortcut and, if you tick it, a desktop shortcut.
5. Start **Equity Desk**.

### Option B: Portable zip

1. Download `EquityDesk-1.1.0-beta.1-win32-x64.zip` from [Releases](../../releases).
2. Right-click the zip > **Extract All...** and pick a folder, for example `Documents\EquityDesk`.
3. Open the folder and double-click `EquityDesk.exe`.

Nothing is installed, so you can run it from a USB drive. Your settings are still saved in `%APPDATA%\Equity Desk`.

### First launch

The first launch asks for:

1. Display language: English, or Traditional Chinese (Hong Kong).
2. A display name, primary market, location, time zone and primary currency.
3. An AI assistant: a free local model (Gemma 4 or gpt-oss through Ollama), or skip it and add a cloud provider later.

You can change all of these later in **SET** (Ctrl+8). Press **F1** for every command and key.

---

## macOS (with Wine)

> **Not officially supported.** Equity Desk is built for Windows. Running it with Wine works for many people, but some features may misbehave. Please report problems in an issue and mention that you use Wine.

**You need:** macOS 13 Ventura or newer, an Apple Silicon (M1 or later) or Intel Mac, 16 GB RAM recommended, and [Homebrew](https://brew.sh).

### 1. Install Rosetta (Apple Silicon only)

Open **Terminal** and run:

```sh
softwareupdate --install-rosetta --agree-to-license
```

### 2. Install Wine

```sh
brew install --cask --no-quarantine wine@devel
```

Check that it works:

```sh
wine --version
```

### 3. Install Equity Desk

Use the **portable zip**. It is simpler under Wine than the installer.

1. Download `EquityDesk-1.1.0-beta.1-win32-x64.zip` from [Releases](../../releases).
2. Unzip it, for example into `~/Applications/EquityDesk`.
3. Start it from Terminal:

```sh
cd ~/Applications/EquityDesk
wine EquityDesk.exe
```

If the window stays blank or Wine reports a graphics error, try:

```sh
wine EquityDesk.exe --disable-gpu
```

The first start takes longer while Wine sets itself up.

### 4. Install Ollama for macOS (strongly recommended for the AI assistant)

Do this **before** you use the AI assistant. Otherwise the app tries to start the Windows version of Ollama inside Wine, which cannot use the Mac's GPU and is roughly 10 to 30 times slower.

1. Download Ollama for macOS from [ollama.com/download](https://ollama.com/download) and open it.
2. In Terminal, download the default model:

   ```sh
   ollama pull gemma4
   ```

3. Keep the Ollama app running (it sits in the menu bar), then start Equity Desk.

Equity Desk connects to Ollama at `127.0.0.1:11434`, which is shared between Wine and macOS, so it uses the Mac version automatically. In **SET** > **AI assistant** you should see `gemma4` listed.

### Where your files are on a Mac

Settings, watchlists and keys are saved inside Wine's folder:

```
~/.wine/drive_c/users/<your Mac user name>/AppData/Roaming/Equity Desk/
```

API keys are encrypted with Windows secure storage. Under Wine this protection may be weaker than on real Windows, or unavailable (in which case keys are kept in memory only and forgotten when the app closes). Check **SET** > **API keys and privacy** for the status.

---

## Optional: local AI with Ollama

The AI assistant can run free on your own computer through [Ollama](https://ollama.com), or use a paid cloud provider with your own API key.

**Windows:** in **SET** > **AI assistant**, press **Install Ollama**, then download a model. Or install Ollama yourself from [ollama.com/download](https://ollama.com/download) and run `ollama pull gemma4` in PowerShell.

**Mac:** see [step 4 above](#4-install-ollama-for-macos-strongly-recommended-for-the-ai-assistant).

Which model suits your computer, and how fast it will be, is in [RECOMMENDED-SPECS.md](RECOMMENDED-SPECS.md). On a laptop without an NVIDIA GPU, local answers can take a few minutes; a cloud provider answers in seconds.

---

## Updating and uninstalling

**Update:** download the new version from [Releases](../../releases) and install it over the old one (installer), or replace the folder (portable zip). Your settings, watchlists and keys are kept.

**Uninstall on Windows:** **Settings** > **Apps** > **Equity Desk** > **Uninstall**. For the portable version, delete its folder. To remove your settings and keys too, delete `%APPDATA%\Equity Desk`.

**Uninstall on Mac:** delete the Equity Desk folder and the `Equity Desk` folder inside Wine (path above). To remove Wine itself: `brew uninstall --cask wine@devel`.

**Remove Ollama models:** in **SET** > **AI assistant**, or run `ollama rm gemma4`.
