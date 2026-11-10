/* Example custom indicator (C): Bollinger Bands on the price chart.
 * Import it in Equity Desk: tab 6 CUSTOM > Indicators > Import .py or .c
 * Needs a C compiler (gcc, clang or tcc); set its path in SET if it is not on PATH.
 *
 * @name Bollinger (example)
 * @pane overlay
 * @outputs mid upper lower
 * @param length 20
 * @param mult 2
 */
#include <math.h>

/* n bars, oldest first. params[] holds the @param values in order (length, mult).
 * out[k][i] is output k (mid, upper, lower) at bar i; it starts as NAN = "no value". */
void compute(int n, const double *open, const double *high, const double *low,
             const double *close, const double *volume, const double *params,
             double **out)
{
    int len = (int)params[0];
    double mult = params[1];
    if (len < 1) len = 1;
    for (int i = len - 1; i < n; i++) {
        double sum = 0, sq = 0;
        for (int j = i - len + 1; j <= i; j++) { sum += close[j]; sq += close[j] * close[j]; }
        double mean = sum / len, var = sq / len - mean * mean;
        double sd = var > 0 ? sqrt(var) : 0;
        out[0][i] = mean;
        out[1][i] = mean + mult * sd;
        out[2][i] = mean - mult * sd;
    }
}
