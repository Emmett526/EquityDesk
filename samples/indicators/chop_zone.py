# @name Chop Zone
# @pane separate
# @outputs chop chop_color
# @plot chop hist
# @palette chop #26C6DA #43A047 #A5D6A7 #009688 #FDD835 #FFB74D #FF6D00 #E91E63 #D50000
# @param ema_length 34
# @param periods 30
# Chop Zone (as on TradingView): every bar is a column of height 1, coloured by the angle of the EMA.
# Turquoise / greens = EMA rising steeply to gently, yellow = flat (chop), oranges / reds = falling.
# chop_color is an index into the @palette above. Pure Python, no packages needed.
import math

COLOURS = [(5, 0), (3.57, 1), (2.14, 2), (0.71, 3)]          # rising angles  -> turquoise, dark green, pale green, lime
FALLING = [(-5, 8), (-3.57, 7), (-2.14, 6), (-0.71, 5)]      # falling angles -> dark red, red, orange, light orange
YELLOW = 4


def ema(values, n):
    out = [None] * len(values)
    if len(values) < n:
        return out
    e = sum(values[:n]) / n          # seed with the simple average of the first n bars
    out[n - 1] = e
    k = 2 / (n + 1)
    for i in range(n, len(values)):
        e = values[i] * k + e * (1 - k)
        out[i] = e
    return out


def zone(angle):
    if angle >= 0:
        for limit, idx in COLOURS:
            if angle >= limit:
                return idx
        return YELLOW
    for limit, idx in FALLING:
        if angle <= limit:
            return idx
    return YELLOW


def compute(bars, params):
    high, low, close = bars["high"], bars["low"], bars["close"]
    n_ema = max(1, int(params.get("ema_length", 34)))
    periods = max(2, int(params.get("periods", 30)))
    size = len(close)
    avg = [(h + l + c) / 3 for h, l, c in zip(high, low, close)]
    e = ema(close, n_ema)
    chop, colour = [None] * size, [None] * size
    for i in range(max(periods - 1, n_ema), size):
        hh = max(high[i - periods + 1:i + 1])
        ll = min(low[i - periods + 1:i + 1])
        if hh == ll or avg[i] == 0 or e[i - 1] is None:
            continue
        span = 25 / (hh - ll) * ll
        y2 = (e[i - 1] - e[i]) / avg[i] * span      # x runs 0 -> 1 over one bar
        c = math.sqrt(1 + y2 * y2)
        angle = round(180 * math.acos(1 / c) / math.pi)
        if y2 > 0:
            angle = -angle
        chop[i] = 1
        colour[i] = zone(angle)
    return {"chop": chop, "chop_color": colour}
