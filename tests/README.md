# Validation

103 checks over the pricing model, the full analysis chain, the data layer and
the chart presentation. No test framework: each file is a standalone script
that exits non-zero on failure, so it runs anywhere Node and esbuild are
available.

| File | Checks | Covers |
| --- | --- | --- |
| `model.test.ts` | 44 | Event counting rules, trend adjustment, frequency fitting, distributions, money outcomes, pricing identities, volume discount |
| `analysis.test.ts` | 23 | Full analysis, peril bundling, projection path and bands, plus a 400-case fuzz over random assumptions |
| `data.test.ts` | 22 | Request construction, error handling, rate-limit backoff, climate model parsing, WorldPop polygon and task polling, geometry |
| `charts.test.ts` | 14 | Axis ticks always keep the final year, and the outlook tooltip renders the confidence band as a range |

Run one with:

```bash
npx esbuild tests/model.test.ts --bundle --platform=node --outfile=/tmp/t.js && node /tmp/t.js
```

`charts.test.ts` renders components, so it needs the JSX flag:

```bash
npx esbuild tests/charts.test.ts --bundle --platform=node --jsx=automatic --outfile=/tmp/t.js && node /tmp/t.js
```

The data tests stub `globalThis.fetch`, so nothing touches the network.
