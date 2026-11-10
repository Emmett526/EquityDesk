# Example custom indicator (Python): two moving averages on the price chart.
# Shows several outputs and several inputs.
#
# @name MA cross (example)
# @pane overlay
# @outputs fast slow
# @param fast 20
# @param slow 50


def sma(values, n):
    out, total = [None] * len(values), 0.0
    for i, v in enumerate(values):
        total += v
        if i >= n:
            total -= values[i - n]
        if i >= n - 1:
            out[i] = total / n
    return out


def compute(bars, params):
    close = bars["close"]
    return {
        "fast": sma(close, max(1, int(params["fast"]))),
        "slow": sma(close, max(1, int(params["slow"]))),
    }
