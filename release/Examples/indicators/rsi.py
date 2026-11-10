# Example custom indicator (Python): Relative Strength Index in a lower pane.
# Import it in Equity Desk: tab 6 CUSTOM > Indicators > Import .py or .c
#
# @name RSI (example)
# @pane separate
# @outputs rsi
# @param length 14
# @level 30 70
# @plot rsi line


def compute(bars, params):
    """bars: dict of lists (time, open, high, low, close, volume), oldest first.
    params: dict of the @param values, e.g. {"length": 14}.
    Return one list (same length as the bars), a list of lists, or {name: list}.
    Use None where there is no value yet."""
    close = bars["close"]
    n = max(1, int(params.get("length", 14)))
    out = [None] * len(close)
    if len(close) <= n:
        return out
    gain = loss = 0.0
    for i in range(1, n + 1):
        d = close[i] - close[i - 1]
        gain += max(d, 0)
        loss += max(-d, 0)
    gain /= n
    loss /= n
    out[n] = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
    for i in range(n + 1, len(close)):                  # Wilder smoothing
        d = close[i] - close[i - 1]
        gain = (gain * (n - 1) + max(d, 0)) / n
        loss = (loss * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
    return out
