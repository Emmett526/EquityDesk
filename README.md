# Equity Desk

**A keyboard-driven, Bloomberg-style equity research terminal for Windows.**
Charts, monitor, financials, valuation, options and news in one window, with an optional AI assistant that can run free on your own PC.

**Latest: Beta 1.1.4 (`1.1.0-beta.5`)** · Closed beta · Windows 10/11 64-bit · by Emmett526

[**Download the latest beta**](https://github.com/Emmett526/EquityDesk/releases/tag/v1.1.0-beta.5) · [All releases](https://github.com/Emmett526/EquityDesk/releases) · [Changelog](CHANGELOG.md) · [Report a bug](https://github.com/Emmett526/EquityDesk/issues)

> [!WARNING]
> **Research only.** Equity Desk cannot place, change or cancel orders, has no paper trading and never sees your brokerage account. Order books are display only. Prices can be delayed or wrong. Nothing in the app, including the AI assistant, is financial advice.

<!-- Screenshot: add a current screenshot here, for example:
![Equity Desk GP charts](docs/screenshots/gp.png)
-->

---

## Contents

- [Features](#features)
- [System requirements](#system-requirements)
- [Install](#install)
- [First launch](#first-launch)
- [Usage guide](#usage-guide)
- [Your data and API keys](#your-data-and-api-keys)
- [Customise](#customise)
- [Updating and uninstalling](#updating-and-uninstalling)
- [Run from source](#run-from-source)
- [Beta status and known issues](#beta-status-and-known-issues)
- [Licence](#licence)
- [Not affiliated](#not-affiliated)

---

## Features

| Tab | Name | What it does |
| --- | --- | --- |
| 1 | **DESK** | Home screen: world markets, rates / FX / commodities, your movers, top headlines and an AI market brief |
| 2 | **MON** | Monitor for your watchlists (up to 500 tickers), with price, change and stats such as Beta, Alpha, HV and YTD |
| 3 | **GP** | Dockable charts (split, resize and join panels), 1-second to monthly bars, TradingView-style drawings and 120+ built-in indicators. Panels for the order book, news, AI and **Options** |
| 4 | **FIN** | Company financials: overview, statements, statistics, estimates, dividends, earnings and revenue segments, plus a technicals rating next to the analyst rating |
| 5 | **VAL** | Valuation: DCF with bear / base / bull cases, relative valuation, discount rate (WACC), analyst forecasts and fundamentals with an economic moat check |
| 6 | **QUANTS** | Coming soon |
| 7 | **NEWS** | Market and per-ticker headlines from public feeds |
| 8 | **SET** | Profile, language, data providers, AI assistant, API keys, and **Custom** (your own indicators and themes) |
| 9 | **HELP** | Every command and key, all rebindable |

Also:

- **Options panel** (US stocks and ETFs, from Yahoo option chains): net gamma exposure (GEX), call wall, put wall, zero gamma, max pain, expected move, put/call ratios, at-the-money implied volatility, and GEX / open interest by strike.
- **AI assistant**: free and local through [Ollama](https://ollama.com) (Gemma 4 or gpt-oss), or a paid provider with your own API key. A cost reminder shows before each paid message.
- **Order book display** from broker accounts you already have (IBKR, Futu / moomoo, Longbridge, Tiger, Schwab) or Databento (Nasdaq TotalView / NYSE OpenBook). Display only.
- **Your own Python or C indicators** and cosmetic **UI themes**.
- **English and Traditional Chinese (Hong Kong).** In Chinese mode, news, company names and FIN profiles come from Chinese sources first.
- **Free market data**: quotes, charts, MON and DESK use Yahoo Finance and need no key.

---

## System requirements

The charts, news and data tabs are light. The **local AI assistant** is the heavy part, because it runs a language model on your own computer. Without local AI, any PC at the Minimum tier is fine.

| Tier | Hardware | Local AI assistant |
| --- | --- | --- |
| **Minimum** | Windows 10/11 64-bit, 4-core CPU, 8 GB RAM, 2 GB free disk, internet connection | App runs fine. Local AI is not practical: use a cloud AI provider, or turn the assistant off |
| **Usable** | 16 GB RAM, recent Intel Core i5 / AMD Ryzen 5, 15 GB free disk | Works but slow: about **2 to 4 minutes** per answer |
| **Recommended** | 32 GB RAM, Intel Core i7 / AMD Ryzen 7 with DDR5, 25 GB free disk | Workable: about **1 to 2 minutes** per answer |
| **Best** | NVIDIA GPU with 6 GB VRAM or more (RTX 4050 / 4060 or better), 16 GB+ RAM | Quick: about **10 seconds** per answer |

Disk space covers the app (about 300 MB) plus local AI models (Gemma 4 E4B about 10 GB, gpt-oss 20B about 14 GB).

**Which local model to pick**

| Your computer | Suggested model |
| --- | --- |
| 16 GB RAM or less, no NVIDIA GPU | Gemma 4 E2B (smallest), or a cloud provider |
| 16 to 24 GB RAM | Gemma 4 E4B (default) |
| 32 GB RAM or more, or a GPU with 16 GB VRAM | gpt-oss 20B or Gemma 4 26B |
| 64 GB RAM or a 24 GB GPU | Gemma 4 31B |

> [!NOTE]
> The AI speeds are **estimates** from published benchmarks for the same models, not measurements on every kind of PC. Full table, Mac figures and how they were estimated: [RECOMMENDED-SPECS.md](RECOMMENDED-SPECS.md). If you test Equity Desk on your machine, please share your numbers in an issue.

---

## Install

Download from the [latest release](https://github.com/Emmett526/EquityDesk/releases/tag/v1.1.0-beta.5) under **Assets**.

### Option A: Installer (recommended)

1. Download `EquityDesk-Setup-1.1.0-beta.5.exe`.
   If your browser blocks the `.exe`, download `EquityDesk-Setup-1.1.0-beta.5.zip` instead and unzip it.
2. Double-click the installer. No administrator rights are needed.
3. If Windows SmartScreen says **"Windows protected your PC"**, click **More info** > **Run anyway**. This appears because the app is not code-signed yet.
4. Accept the licence and choose where to install. You get a Start menu shortcut and, if you tick it, a desktop shortcut.
5. Start **Equity Desk**.

Installing over an earlier beta updates it in place and keeps your settings, keys, watchlists and layouts.

### Option B: Portable zip

1. Download `EquityDesk-1.1.0-beta.5-win32-x64.zip`.
2. Right-click it > **Extract All...** and pick a folder, for example `Documents\EquityDesk`.
3. Open the folder and double-click `EquityDesk.exe`.

Nothing is installed, so it also runs from a USB drive. Settings are still saved in `%APPDATA%\Equity Desk`.

### Optional: local AI with Ollama

In **SET** (Ctrl+8) > **AI assistant**, press **Install Ollama**, then download a model. Or install Ollama yourself from [ollama.com/download](https://ollama.com/download) and run:

```powershell
ollama pull gemma4
```

### Optional: FMP key for revenue segments

An FMP (Financial Modeling Prep) key adds revenue by business and by region to **FIN > Segments**. Everything else works without it.

1. Sign up for the free Basic plan at [financialmodelingprep.com](https://site.financialmodelingprep.com/) and copy your API key from the Dashboard.
2. In Equity Desk open **SET** > **Data providers**, paste it into **FMP API key** and press **Save**.
3. Press **Test**. "FMP OK: Apple Inc." means it works.
4. Type `NVDA FA` and open the **Segments** tab.

<details>
<summary>Free plan limits</summary>

- 250 calls a day, reset at midnight UTC (8:00 am Hong Kong time). The app stops at 240 to keep a margin.
- FMP is used only for FIN segments, never for live prices or charts, so refreshes cost nothing.
- Each new company costs 2 calls and is saved for 7 days, so opening it again is free.
- The free plan covers US stocks only, so tickers like `0700.HK` never use a call.
- SET > Data providers shows today's count. **Remove** deletes the key.

</details>

### macOS

Equity Desk is a Windows app. It can run on a Mac through Wine, but this is **not officially supported**. Steps are in [INSTALL.md](INSTALL.md#macos-with-wine).

---

## First launch

The first start asks for:

1. **Display language**: English, or 繁體中文（香港）.
2. **Profile**: display name, primary market, location, time zone and primary currency. Prices on DESK and MON also show in your currency.
3. **AI assistant**: a free local model (Gemma 4 or gpt-oss through Ollama), or skip it and add a cloud provider later.

Change any of these later in **SET** (Ctrl+8). Press **F1** at any time for every command and key.

---

## Usage guide

### Moving around

- **Ctrl+1 to Ctrl+9** open the tabs in the order shown in [Features](#features).
- **F1** or `HELP` lists every command and key. Every key can be rebound in HELP.
- Type a command anywhere and press **Enter**. Tickers use Yahoo style (`NVDA`, `0700.HK`, `7203.T`, `^GSPC`, `EURUSD=X`). Bloomberg-style codes work too: `700 HK`, and a bare number like `700` gets your primary market's suffix.

### Common commands

| Type | Opens |
| --- | --- |
| `NVDA` then **F8** | Chart for NVDA |
| `SPX` then **F10** | Index chart |
| `NVDA FA` | FIN financials (`NVDA DES` overview, `NVDA ERN` earnings, `NVDA DVD` dividends, `NVDA EE` estimates) |
| `NVDA VAL` | VAL valuation (`NVDA DCF` opens straight on the DCF page) |
| `NVDA GEX` | Options panel for NVDA (`GEX`, `OPT` or `OMON` alone opens the panel) |
| `NVDA BOOK` | Order book panel (display only) |
| `NVDA CN` | News for NVDA (`N` or `TOP` alone for top news) |
| `ASK <question>` | Ask the AI assistant |
| `CUSTOM`, `IND`, `UI` | Custom indicators and themes (SET > Custom, also **Ctrl+Shift+8**) |
| `RESETUI` | Put the default look back |

### Charts (GP, Ctrl+3)

- Use **Add** to split the screen into more panels: chart, order book, news, AI or **Options**. Drag the edges to resize, or join panels back together. Layouts are saved.
- Press **/** on a chart to add an indicator, and use the drawing tools for trend lines, levels and more.
- The top left of each chart shows the last price, change, market state and volume. Scroll left for more history.

### Watchlists (MON, Ctrl+2)

- MON shows one watchlist (Main by default). Pick another from the list at the top.
- **Edit .json** opens `watchlists.json` in your text editor. Save it and MON updates within about 2 seconds.
- **Import .json** / **Export .json** share lists. Import also reads plain `.txt` / `.csv` lists.

### Financials and valuation (FIN Ctrl+4, VAL Ctrl+5)

- FIN and VAL follow the active chart, like NEWS. Choose **Active chart** or **Symbol** at the top; typing a ticker switches to Symbol.
- In VAL > DCF you can change revenue growth, FCF margin, discount rate and terminal growth. **Reset** puts the data values back.
- VAL figures are simple models for research, not advice.

### Options (GP > Add > Options)

- Pick expirations at the top: nearest, next 7 / 30 / 60 days, or one expiry date.
- US stocks and ETFs only. Data refreshes every 5 minutes; **↻** refreshes now.

### AI assistant

- Open it as a GP panel or type `ASK <question>`.
- **Desk context** sends what is on your screen with your question. Turn it off when you don't need it; answers get much faster.
- Local models keep everything on your PC. Cloud providers are paid and receive your question.

---

## Your data and API keys

Everything the app saves stays on your PC in `%APPDATA%\Equity Desk\` (open it from **SET** > **API keys and privacy** > **Show settings folder**).

| File | Holds |
| --- | --- |
| `settings.json` | Settings and API keys (keys encrypted) |
| `watchlists.json` | All watchlists and which one MON shows |
| `profile.json` | Name, market, time zone, currency |
| `skin.json` | Your custom theme |
| `lang.json` | Display language |
| `fmp-cache.json` | Saved FMP answers and today's call count |
| `indicators\` | Copies of your custom indicators |

API keys are encrypted with your Windows account (Windows DPAPI through Electron safeStorage). Another Windows user or another PC can't decrypt them. Keys never appear in the window, logs or exports, and each key is only sent to the service it belongs to. **SET** > **API keys and privacy** shows the status and has **Remove all keys**.

---

## Customise

Open **SET** > **Custom** (Ctrl+Shift+8). Working examples for everything below are in the `Examples` folder that ships with the app (see `Examples\GUIDE.txt`).

**Custom indicators** (`.py` or `.c`): header lines set the name and inputs, then you write one `compute` function.

```python
# @name RSI 14
# @pane separate
# @outputs rsi
# @param length 14
# @level 30 70
def compute(bars, params):
    # bars: dict of lists time, open, high, low, close, volume (oldest first)
    # return one list as long as the bars; use None where there is no value
    ...
```

Python files need Python 3 from [python.org](https://www.python.org). C files need a compiler such as w64devkit, MSYS2 gcc or TCC. Set their paths in SET if they are not on PATH.

> [!CAUTION]
> Imported `.py` and `.c` files run as normal programs on your PC. Only import files you wrote or trust.

**Themes** (`.html` + CSS, `.py` or `.c`): change colours, font, text size, corner radius, gradients, small shadows and the tab order. Themes can only change the look; anything else is ignored and listed. Type `RESETUI` to go back to the default.

---

## Updating and uninstalling

**Update:** download the new release and install it over the old one, or replace the portable folder. Settings, watchlists and keys are kept.

**Uninstall:** Windows **Settings** > **Apps** > **Equity Desk** > **Uninstall**. For the portable version, delete its folder. To remove your settings and keys too, delete `%APPDATA%\Equity Desk`.

**Remove AI models:** in **SET** > **AI assistant**, or run `ollama rm gemma4`.

---

## Run from source

Needs [Node.js](https://nodejs.org) and Windows for the full feature set.

```sh
cd app
npm ci
npm start
```

- `EQUITY_MOCK=1` runs the app with mock market data.
- `npm test` checks the options and DCF maths.
- `npm run dist` packages a Windows build with Electron Packager.

Repo layout: `app/` app source, `installer/` NSIS installer script, `release/` files shipped next to the app (readme, licence, notices, Examples), `samples/` sample indicators.

API keys are never stored in this repo.

---

## Beta status and known issues

This is a closed beta, so expect rough edges.

- Builds are tested with mock data. Live data, brokers, AI providers and Windows-specific features have had little real-world testing, so please report anything that breaks.
- **GEX can come out empty or near zero while the US market is closed**, because Yahoo then reports almost no implied volatility. A fix is planned.
- Data comes from free public sources and may be delayed, rate-limited or briefly unavailable.
- Local AI speed depends heavily on your hardware (see [System requirements](#system-requirements)).
- The app is not code-signed yet, so Windows SmartScreen warns on first run.

Found a bug or have an idea? [Open an issue](https://github.com/Emmett526/EquityDesk/issues). Mention the Equity Desk version and your Windows version.

**Versioning:** releases use [semantic versioning](https://semver.org). Betas are `X.Y.Z-beta.N`, shown in the app as "Beta 1.1.4" and so on. The first stable release will drop `-beta`. See the [changelog](CHANGELOG.md).

---

## Licence

Free for **personal, non-commercial use only**. No selling, no use inside a business, and no publishing modified versions of the app. See [LICENSE](LICENSE).

Open-source parts (Electron, Chromium, TradingView Lightweight Charts™ and others) keep their own licences, listed in `THIRD-PARTY-NOTICES.txt` in the app folder.

Copyright © 2026 Emmett526.

## Not affiliated

Equity Desk is an independent personal project. It is not affiliated with, endorsed by or connected to any company or project it mentions or connects to, including NYSE, Nasdaq, Interactive Brokers, Yahoo, Google, OpenAI, Anthropic, Financial Modeling Prep, Databento, Futu / moomoo, Longbridge, Tiger Brokers, Charles Schwab, Ollama, TradingView or Bloomberg. Their names and trademarks belong to their owners and are used only to say which service a feature connects to. Market data, news and AI models come from those services under their own terms.
