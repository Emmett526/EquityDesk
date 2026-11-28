# Changelog

All notable changes to Equity Desk. Versions follow [semantic versioning](https://semver.org): beta releases are numbered `X.Y.Z-beta.N` and shown in the app as "Beta X.Y.Z". Downloads for every version are on the [Releases](https://github.com/Emmett526/EquityDesk/releases) page.

## Beta 1.1.4 (1.1.0-beta.5) - 2026-11-27 (latest)

- New Options panel in GP (GP > Add > Options, or type GEX, OPT or NVDA GEX), using Yahoo option chains for US stocks and ETFs (refreshed every 5 minutes). It follows the active chart like NEWS:
  - Summary: net gamma exposure (GEX), call wall, put wall, zero gamma (gamma flip), max pain, expected move from the at-the-money straddle, put/call ratios (open interest and volume) and at-the-money implied volatility
  - GEX and open interest (puts | calls) for each strike near the price, with the key levels marked
  - Pick the expirations at the top: nearest, next 7 / 30 / 60 days, or one expiry date
- Chart indicators are the same as in Beta 1.1.3
- QUANTS stays a coming-soon placeholder
- Traditional Chinese for text that comes from the data: Yahoo sectors and industries, countries and regions, common FMP segment names, the FIN source line and the VAL source
- Fixes:
  - Fixed: MON Alpha, HV % and YTD % were always empty with live data, and Beta always showed Yahoo's own figure. They are now worked out from a year of daily prices vs SPY, as the column tips say. The Δ call / Θ backup that uses HV works again
  - Fixed: the Options panel's ↻ button and its 5-minute refresh now get fresh option chains (before, they could show the same data for up to 10 minutes)
  - Fixed: the Options panel no longer shows the previous ticker's numbers while a new one loads
  - Fixed: expected move no longer drops to half when the call or the put has no price; it uses implied volatility instead
  - Fixed: one bad character in a news feed no longer hides that whole source
  - Yahoo requests share one sign-in and give up after 12 seconds instead of hanging, so MON stats, FIN and Options fail less often at start-up
  - Settings, keys and watchlists are saved safely: a crash or power cut while saving can no longer leave an empty file
  - Charts without drawings no longer repaint every frame, so idle CPU use is lower
  - Removed unused leftovers (the old provider-order setting and a few unused lines); added `npm test` for the options and DCF maths

## Beta 1.1.3 (1.1.0-beta.4) - 2026-11-25

- Charts show the price at the top left: last price, change and % change from the previous close (green / red), market open / pre-market / after hours / closed, and volume. Hovering a candle also shows its change from the candle before
- Charts load earlier history (up to 10 years of daily bars, all weekly and monthly history, 2 years of hourly, about a month of 5- to 30-minute bars) and open on the range you picked, so scrolling left shows the previous days, weeks, months and years instead of stopping
- Technicals rating shows in one place only, FIN > Estimates, next to the analyst rating (removed from VAL > Forecasts and VAL > Summary; the extra coloured scale is gone too)
- FIN and VAL follow the active chart, like NEWS (Active chart / Symbol box at the top). Typing a ticker or a command like NVDA FA switches to Symbol
- Traditional Chinese now covers the rest of FIN (Estimates, Statements, Statistics, Dividends, Earnings, Segments, dates and chart tips), the technicals indicator list and the last English bits in VAL and on charts
- Empty branding/ folder for the future app logo (the app still uses the Electron icon)

## Beta 1.1.2 (1.1.0-beta.3) - 2026-11-24

- New technicals rating, Strong sell to Strong buy, from a year of daily prices: 12 moving averages (SMA and EMA 10 to 200) and 9 oscillators (RSI, Stochastic, CCI, ADX, Awesome oscillator, Momentum, MACD, Williams %R, Ultimate oscillator) each vote buy, neutral or sell. Shown in the same bar style as the analyst rating, in FIN > Estimates and VAL > Forecasts, with every indicator's value and signal under "All indicators"; VAL > Summary shows the result too
- New tab order: 1 DESK, 2 MON, 3 GP, 4 FIN, 5 VAL, 6 QUANTS, 7 NEWS, 8 SET, 9 HELP (Ctrl+number follows; keys you changed yourself stay as you set them)
- New tab 6 QUANTS: coming soon
- CUSTOM (custom indicators and custom UI) moved inside SET: SET has General and Custom at the top. Ctrl+Shift+8, or the commands CUSTOM, IND and UI, open it directly
- Theme files can name the new tab QUANTS; saved tab orders from older versions still work (missing tabs are added at the end)

## Beta 1.1.1 (1.1.0-beta.2) - 2026-11-17

- Fixed: MON and watchlists stopped loading prices and stats after the first 60 tickers. Any number of tickers now load (up to 500), fetched 12 at a time so Yahoo isn't flooded
- A MON refresh no longer starts while the previous one is still running, so long lists don't pile up requests
- VAL DCF is more realistic, especially for cyclical stocks at a peak (for example memory chip makers): it now projects revenue and free cash flow margin separately. Next year's analyst growth is no longer carried for five years; it moves to a year-5 rate (analysts' 5-year estimate, or at most 8%). Today's FCF margin moves halfway back towards its usual level over five years. New boxes: revenue growth year 1, revenue growth year 5, FCF margin
- VAL relative valuation: when margins are far above their usual level, earnings and cash flow are scaled back halfway before applying the usual multiples, with a note saying so
- VAL bear and bull cases now also move the year-5 growth and the FCF margin

## Beta 1.1.0 (1.1.0-beta.1) - 2026-11-16

- New tab 6 VAL (Valuation), Ctrl+6, or type a ticker with VAL, DCF, VALUATION or FV (for example NVDA VAL, AAPL DCF)
- Summary: estimated intrinsic value (average of the DCF and relative values), upside or downside against the price, a fairly valued / undervalued / overvalued label, and a bar that shows the price against the bear, base and bull values
- DCF: 10-year free cash flow model with bear, base and bull scenarios; change revenue growth, FCF margin, discount rate and terminal growth yourself (Reset puts them back); projection table, terminal value, enterprise to equity bridge and a discount rate / terminal growth sensitivity grid
- Relative valuation: today's P/E, P/S, P/FCF and EV/EBITDA against the stock's own history, with the price each multiple implies
- Discount rate: WACC built step by step (risk-free rate, beta, equity risk premium, cost of debt, tax, weights)
- Forecasts: analyst price targets (low, mean, high) and revenue / EPS estimates where Yahoo has them, plus past EPS against estimates
- Fundamentals: profitability (margins, ROE, ROIC), solvency (debt, cash, interest cover, current ratio) and an economic moat check from six tests (Wide, Narrow or None found)
- All VAL text in English and 繁體中文（香港）; numbers in the stock's trading currency
- VAL figures are simple models for research, not advice
- Tabs 6 and 7 swapped: CUSTOM (indicators and UI themes) is now tab 7 (Ctrl+7) and VAL is tab 6 (Ctrl+6); keys you changed yourself stay as you set them

## Beta 1.0.2 (1.0.0-beta.3) - 2026-11-13

- Chinese sources when the display language is 繁體中文（香港）: NEWS and DESK headlines now come from Chinese-language feeds first (Yahoo 財經 Hong Kong, RTHK 香港電台 財經, Ming Pao 明報財經, Google 新聞 Hong Kong, and the Chinese editions of Western outlets: 華爾街日報 WSJ, 紐約時報中文網 NYT, BBC 中文, FT中文網), newest first, then the English sources below an "English sources" divider so there is always something to read
- Per-symbol news in Chinese: Yahoo 財經 headlines for the ticker, Google 新聞 searched by the company's Chinese name, and RTHK / Ming Pao headlines that mention the Chinese name or HK code (for example 騰訊 or 00700)
- Chinese company names in MON / watchlists and FIN (for example 0700.HK shows 騰訊控股), with the English name next to it in FIN; FIN sector, industry and business summary in Chinese where Yahoo has them
- FT中文網 headlines are converted from Simplified to Traditional Chinese (OpenCC); NYT 中文網 headlines come through Google News, since NYT has no open feed
- English mode is unchanged: same English sources, no Chinese feeds
- Switching language reloads news, names and FIN straight away
- The NEWS Sources menu lists the Chinese sources in Chinese mode; each can be switched off
- Fixed: duplicate-headline check ignored Chinese characters, which would have hidden most Chinese headlines
- DESK: "FMP key (optional)" box with step-by-step instructions in English and Chinese, buttons to open the FMP website and SET, and Hide; it disappears once a key is saved

## Beta 1.0.1 (1.0.0-beta.2) - 2026-11-10

- FMP (Financial Modeling Prep) is now used only for FIN data (revenue by business and region), never for live quotes, charts, MON or DESK, so the free plan's 250 calls a day are no longer used up by refreshes
- Quotes and charts always come from Yahoo Finance; the "FMP first / Yahoo only / FMP only" setting is gone
- FMP answers are saved on your PC for 7 days (fmp-cache.json in the settings folder), so opening the same company again costs no calls
- FMP calls are counted per day, shown in SET > Data providers, and the app stops at 240 to keep a margin; FIN keeps working from Yahoo and saved copies
- Non-US symbols (for example 0700.HK) no longer call FMP, since the free plan covers US stocks only
- The FMP key test uses one call to the company profile instead of a live quote
- Step-by-step FMP key instructions in README.md
- Licence rule 1 reworded: personal, non-commercial download, install and use (the line about sharing copies was removed)

## Beta 1.0 (1.0.0-beta.1) - 2026-11-10

First public beta. Earlier builds were internal development versions.

- DESK home screen: world markets, rates/FX/commodities, your MON movers, top headlines, AI market brief
- MON monitor and watchlists, all kept in one `watchlists.json`; import and export as .json
- GP charts: 1s to 1M timeframes, dockable layouts, TradingView-style drawings, 122 built-in indicators
- FIN company financials: statements, statistics, estimates, dividends, earnings, segments
- NEWS live headlines
- CUSTOM (tab 6): your own Python or C indicators, and cosmetic UI themes (colours, font, size, tab order)
- Order book display from brokers (IBKR, Futu/moomoo, Longbridge, Tiger, Schwab) and Databento TotalView / OpenBook; display only
- AI assistant: Gemma 4 or gpt-oss on your PC through Ollama (free), or paid providers with your own API key, with a cost reminder
- First-launch profile: language, name, market, time zone, primary currency
- Display languages: English (default) and Traditional Chinese (Hong Kong)
- API keys stored only on your PC, encrypted with your Windows account
- Windows installer and portable zip
- Tab 7 is reserved for a future feature
