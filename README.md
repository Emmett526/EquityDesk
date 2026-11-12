# Equity Desk

**Version: Beta 1.0.1 (`1.0.0-beta.2`)** · by Emmett526

A Bloomberg-style equity research terminal for Windows, built with Electron. It has:

- a market desk and monitor
- charts with TradingView-style drawings and 120+ indicators
- company financials and news
- an AI assistant (local via Ollama, or your own API keys)
- your own Python/C indicators and cosmetic themes
- English and Traditional Chinese (Hong Kong)

Research only: no order entry or paper trading.

## FMP key (optional)

An FMP (Financial Modeling Prep) key adds revenue by business and by region to **FIN > Segments**. Everything else works without it: quotes, charts, MON and DESK always use Yahoo Finance, which is free and needs no key.

**Get a key and add it**

1. Go to [financialmodelingprep.com](https://site.financialmodelingprep.com/) and sign up for the free Basic plan.
2. Sign in, open your Dashboard and copy your API key.
3. In Equity Desk open **SET** (Ctrl+8) > **Data providers** and paste the key into **FMP API key**.
4. Press **Save** at the bottom of SET. The key is encrypted and stored only on your PC.
5. Press **Test** next to the key. "FMP OK: Apple Inc." means it works (the test uses 1 call).
6. Open a US stock in FIN, for example type `NVDA FA`, then choose the **Segments** tab.

**Free plan limits**

- 250 calls a day, reset every day at midnight UTC (8:00 am Hong Kong time).
- FMP is used only for FIN segments, never for live prices or charts, so refreshes cost nothing.
- Each new company costs 2 calls. Its answer is saved for 7 days, so opening it again is free.
- The app stops at 240 calls a day to keep a margin. The rest of FIN keeps working.
- The free plan covers US stocks only, so non-US tickers such as `0700.HK` never use a call.
- SET > Data providers shows how many calls you've used today. **Remove** deletes the key.

## Layout

- `app/` Electron app source (`src/`, `vendor/lwc.js`, `package.json`)
- `installer/` NSIS installer script and node_modules prune script
- `release/` files shipped next to the app (README.txt, licence, notices, Examples)
- `samples/` sample custom indicators

## Run from source

```
cd app
npm ci
npm start
```

Set `EQUITY_MOCK=1` to run with mock market data.

API keys are never stored in this repo. The app saves them encrypted on the user's PC, in `%APPDATA%\Equity Desk`.

## Versioning

Releases use [semantic versioning](https://semver.org). Beta releases are `1.0.0-beta.N`, shown in the app as "Beta 1.0", "Beta 1.0.1" and so on. The first stable release will be `1.0.0`. See `CHANGELOG.md`.

## Licence

Personal, non-commercial use only. See `LICENSE`.
