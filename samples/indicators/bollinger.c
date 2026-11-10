// @name Bollinger Bands
// @pane overlay
// @outputs mid upper lower
// @param length 20
// @param mult 2
#include <math.h>

void compute(int n, const double *open, const double *high, const double *low, const double *close,
             const double *volume, const double *params, double **out)
{
    int len = (int)params[0];
    double mult = params[1];
    if (len < 2) len = 2;
    for (int i = len - 1; i < n; i++) {
        double sum = 0, sq = 0;
        for (int j = i - len + 1; j <= i; j++) { sum += close[j]; sq += close[j] * close[j]; }
        double mean = sum / len, sd = sqrt(fmax(sq / len - mean * mean, 0));
        out[0][i] = mean;
        out[1][i] = mean + mult * sd;
        out[2][i] = mean - mult * sd;
    }
}
