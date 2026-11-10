# Equity Desk

**Version: Beta 1.0 (`1.0.0-beta.1`)** · by Emmett526

A Bloomberg-style equity research terminal for Windows, built with Electron. It has:

- a market desk and monitor
- charts with TradingView-style drawings and 120+ indicators
- company financials and news
- an AI assistant (local via Ollama, or your own API keys)
- your own Python/C indicators and cosmetic themes
- English and Traditional Chinese (Hong Kong)

Research only: no order entry or paper trading.

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

Releases use [semantic versioning](https://semver.org). Beta releases are `1.0.0-beta.N`, shown in the app as "Beta 1.0". The first stable release will be `1.0.0`. See `CHANGELOG.md`.

## Licence

Personal, non-commercial use only. See `LICENSE`.
