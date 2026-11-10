/* Example custom indicator (C): volume compared with its average, as a histogram in a lower pane.
 * 1.0 = normal volume, 2.0 = twice the average.
 *
 * @name Volume spike (example)
 * @pane separate
 * @outputs ratio
 * @param length 20
 * @level 1 2
 * @plot ratio hist
 */
void compute(int n, const double *open, const double *high, const double *low,
             const double *close, const double *volume, const double *params,
             double **out)
{
    int len = (int)params[0];
    if (len < 1) len = 1;
    double sum = 0;
    for (int i = 0; i < n; i++) {
        sum += volume[i];
        if (i >= len) sum -= volume[i - len];
        if (i >= len - 1 && sum > 0) out[0][i] = volume[i] / (sum / len);
    }
}
