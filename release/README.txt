EQUITY DESK BETA 1.0 - READ ME
==============================
Version 1.0.0-beta.2 (Beta 1.0.1). This is a beta: expect rough edges, and please report problems.


1. RESEARCH ONLY, NOT TRADING
-----------------------------
Equity Desk is a research and charting tool. It cannot place, change or cancel orders, it has no paper
trading, and it never sees your brokerage account. Order books from brokers are shown for display only.
Prices can be delayed or wrong. Nothing in the app, including the AI assistant, is
financial advice. You make your own decisions and carry your own risk.

2. INSTALL AND START
--------------------
Run EquityDesk-Setup-1.0.0-beta.2.exe (no admin needed). If SmartScreen warns: More info > Run anyway.
Or unzip the portable version and run EquityDesk.exe.
First launch asks for the display language (English, or Traditional Chinese for Hong Kong), a display name, primary market, location, time zone, primary currency and a free
AI model (Gemma 4 or gpt-oss through Ollama). Change them later in SET > Profile and SET > AI assistant;
the language is in SET > Appearance > Language / 語言. With Chinese selected, the AI assistant also replies
in Chinese. Tickers, commands (DESK, MON, NVDA F8...) and file formats stay the same in every language.

Tabs (Ctrl+number): 1 DESK  2 MON  3 GP (charts)  4 FIN  5 NEWS  6 CUSTOM  7 (coming soon)  8 SET  9 HELP.
Type commands like Bloomberg: NVDA then F8, 700 HK, SPX <F10>, NVDA BOOK, NVDA FA, ASK <question>.
F1 or HELP lists every command and key.

3. YOUR FILES AND API KEYS
--------------------------
Everything the app saves stays on this PC, in:
    %APPDATA%\Equity Desk\        (for example C:\Users\<you>\AppData\Roaming\Equity Desk\)
Open it from SET > API keys and privacy > Show settings folder.

    settings.json     settings and API keys (keys encrypted, see below)
    watchlists.json   all watchlists and which one MON shows
    profile.json      name, market, time zone, currency
    skin.json         your Custom UI theme
    lang.json         display language
    fmp-cache.json    saved FMP answers (7 days) and today's FMP call count
    indicators\       copies of your custom indicators

API keys (FMP, Databento, AI providers, brokers) are stored only in settings.json on this PC, encrypted
with your Windows account (Windows DPAPI through Electron safeStorage). Another Windows user or another PC
cannot decrypt them. Keys are decrypted only inside the app's background process, are never shown in the
window, are kept out of logs, error messages and exports, and each key is only sent to the service it
belongs to. If Windows secure storage is unavailable, keys are kept in memory only and forgotten when the
app closes. SET > API keys and privacy shows the status and has "Remove all keys".

Data sources: quotes, charts, MON and DESK use Yahoo Finance (free, no key). An FMP key is optional and is
used only for FIN revenue segments, never for live data, so the free plan's 250 calls a day last.

4. WATCHLISTS (watchlists.json)
-------------------------------
MON (tab 2) shows one of your watchlists, Main by default; pick another from the list at the top of MON.
MON and the watchlist panels are linked: adding or removing a ticker in one changes the other.
All lists live in one file, watchlists.json. MON > Edit .json opens it in your text editor; when you save,
the app picks up the change within about 2 seconds.

    {
      "monitor": "Main",
      "lists": [
        { "name": "Main",  "symbols": ["NVDA", "ARM", "0700.HK"] },
        { "name": "Asia",  "symbols": ["9988.HK", "7203.T", "2330.TW"] }
      ]
    }

  monitor   the list MON shows (its name or id)
  lists     each list has a name and symbols (Yahoo-style tickers: 0700.HK, 7203.T, ^GSPC, EURUSD=X)
The app adds an "id" to each list and uses "syms" when it saves; both spellings are read.

Import .json / Export .json (in MON and in each watchlist panel) use this shape:
    { "name": "Main", "symbols": ["ARM", "NVDA"] }
Import also reads a plain array ["ARM", "NVDA"], a whole watchlists.json, and .txt/.csv lists.
In a text file, name:{ ARM NVDA } becomes a list called "name". A bare number like 700 gets your
primary market's suffix (0700.HK for Hong Kong); "700 HK" style codes work too.

5. LEGACY: OPEN PICKS.JSON
--------------------------
The "Open picks.json" button on DESK is left over from an early version. It reads an old ideas-file
format that nothing produces any more, so it is not documented and can be ignored. It will be removed
in a later version.

6. CUSTOM INDICATORS (tab 6 > Indicators)
-----------------------------------------
Import a .py or .c file. Header lines set its name and inputs:
    @name      display name
    @pane      overlay (on the price chart) or separate (lower pane)
    @outputs   names of the lines it returns, space separated (up to 8)
    @param     name default            (one line per input, editable on the chart)
    @level     30 70                   (horizontal guide lines)
    @plot      name line|hist|step|dots
    @palette   name #hex #hex ...

Python (uses your installed Python 3):
    # @name RSI 14
    # @pane separate
    # @outputs rsi
    # @param length 14
    # @level 30 70
    def compute(bars, params):
        # bars: dict of lists time, open, high, low, close, volume
        # return one list, a list of lists, or {name: list}; use None for "no value"
        ...

C (compiled once with gcc, clang or tcc; set paths in SET if needed):
    // @name Bollinger 20
    // @outputs mid upper lower
    // @param length 20
    // @param mult 2
    void compute(int n, const double *open, const double *high, const double *low,
                 const double *close, const double *volume, const double *params,
                 double **out)   /* out[k][i], pre-filled with NAN */
    { ... }

Imported code runs as a normal program on your PC. Only import files you trust.

7. CUSTOM UI (tab 6 > UI)
-------------------------
Change the look only: colours, font, text size, corner radius, gradients, small shadows, and the order of
the nine tabs. Tabs can't be renamed, removed or added, and app functions can't be changed. Anything that
is not a look change (hiding or moving things, new text, scripts, web links, @import, huge shadows,
invisible text) is ignored, and the app lists what it ignored. Reset to default, or type RESETUI.

Use the colour pickers, or import a theme file:

HTML + CSS (only the <style> part is used; @name and @tabs go in a comment):
    <!-- @name Ocean   @tabs DESK MON GP NEWS FIN CUSTOM NEW SET HELP -->
    <style>
    :root { --amb: #00c2ff; --yel: #7fffd4; --bg: #020b14; }
    #fkeys button.on { background: linear-gradient(90deg, #00c2ff, #0077ff); }
    .card2 { border-radius: 8px; box-shadow: 0 0 6px #00c2ff55; }
    </style>

Python or C: the program prints one line of JSON:
    {"name": "Ocean", "colors": {"amb": "#00c2ff", "bg": "#020b14"}, "font": "Cascadia Mono, Consolas",
     "fontSize": 13, "radius": 6, "tabs": ["DESK","MON","GP","NEWS","FIN","CUSTOM","NEW","SET","HELP"],
     "css": "#fkeys button.on { background: #00c2ff; }"}

  colors     bg, panel, panel2, panel3, line, line0, line2, line3, ink (text), ink2, hi, mut (muted),
             amb (accent), amb2, yel (highlight), up, dn, blu, hdr (header bars), hdrInk, tint, tint2
  fontSize   11 to 16      radius   0 to 10
  css        allowed properties: color, background (colour or gradient), background-image (gradient),
             border colours, border-radius, box-shadow, text-shadow, font-family, font-weight,
             font-style, letter-spacing, text-transform, text-decoration, caret/accent/outline colours

8. NOT AFFILIATED
-----------------
Equity Desk is an independent personal project. It is not affiliated with, endorsed by, sponsored by or
connected to any of the companies or projects it mentions or connects to, including the New York Stock
Exchange (NYSE / Intercontinental Exchange), Nasdaq, Interactive Brokers (IBKR), Yahoo / Yahoo Finance,
Google (Gemma 4), OpenAI (gpt-oss, ChatGPT), Anthropic (Claude), Financial Modeling Prep, Databento, Futu /
moomoo, Longbridge, Tiger Brokers, Charles Schwab, Ollama, TradingView or Bloomberg. Their names and
trademarks belong to their owners and are used only to say which service a feature connects to. The look
is inspired by professional terminals; no third-party code, logos or content are copied, apart from the
open-source libraries listed in THIRD-PARTY-NOTICES.txt.
Market data, news, filings and AI models come from those services under their own terms. Following those
terms (for example Yahoo's, the Gemma terms of use, or a data vendor's licence) is the user's
responsibility. Names are used for a personal, non-commercial project in the author's view as fair use;
this note is not legal advice.

9. LICENCE
----------
Free for personal, non-commercial use only. No commercial use. See LICENSE-EquityDesk.txt. The included
open-source components keep their own licences (LICENSE, LICENSES.chromium.html, THIRD-PARTY-NOTICES.txt).
