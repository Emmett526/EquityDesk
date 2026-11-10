# @name MACD
# @pane separate
# @outputs macd signal hist
# @param fast 12
# @param slow 26
# @param signal 9
# @level 0
# Returns a dict of named series; numpy would also work here if you have it installed.

def ema(xs, n):
    k, e, out = 2 / (n + 1), None, []
    for x in xs:
        e = x if e is None else x * k + e * (1 - k)
        out.append(e)
    return out

def compute(bars, params):
    c = bars["close"]
    fast, slow, sig = int(params["fast"]), int(params["slow"]), int(params["signal"])
    macd = [a - b for a, b in zip(ema(c, fast), ema(c, slow))]
    signal = ema(macd, sig)
    warm = slow + sig
    blank = lambda s: [None if i < warm else v for i, v in enumerate(s)]
    return {"macd": blank(macd), "signal": blank(signal), "hist": blank([m - s for m, s in zip(macd, signal)])}
