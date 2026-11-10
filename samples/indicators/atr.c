// @name ATR
// @pane separate
// @outputs atr
// @param length 14
// Average True Range (Wilder smoothing). Values left as NAN are not drawn.

void compute(int n, const double *open, const double *high, const double *low, const double *close,
             const double *volume, const double *params, double **out)
{
    int len = (int)params[0];
    if (len < 1 || n <= len) return;
    double atr = 0;
    for (int i = 1; i < n; i++) {
        double tr = high[i] - low[i];
        double a = high[i] - close[i - 1], b = close[i - 1] - low[i];
        if (a < 0) a = -a;
        if (b < 0) b = -b;
        if (a > tr) tr = a;
        if (b > tr) tr = b;
        if (i <= len) { atr += tr / len; if (i == len) out[0][i] = atr; }
        else { atr = (atr * (len - 1) + tr) / len; out[0][i] = atr; }
    }
}
