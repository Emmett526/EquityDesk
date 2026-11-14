# Changelog

Versions follow [semantic versioning](https://semver.org). Beta releases are numbered `1.0.0-beta.N`.

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
