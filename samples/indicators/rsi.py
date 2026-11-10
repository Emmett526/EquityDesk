# @name RSI
# @pane separate
# @outputs rsi
# @param length 14
# @level 30 70
# Wilder's RSI. Pure Python, no packages needed.

def compute(bars, params):
    close = bars["close"]
    n = int(params.get("length", 14))
    out = [None] * len(close)
    if len(close) <= n:
        return out
    gains = losses = 0.0
    for i in range(1, n + 1):
        d = close[i] - close[i - 1]
        gains += max(d, 0)
        losses += max(-d, 0)
    ag, al = gains / n, losses / n
    out[n] = 100 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(n + 1, len(close)):
        d = close[i] - close[i - 1]
        ag = (ag * (n - 1) + max(d, 0)) / n
        al = (al * (n - 1) + max(-d, 0)) / n
        out[i] = 100 if al == 0 else 100 - 100 / (1 + ag / al)
    return out
