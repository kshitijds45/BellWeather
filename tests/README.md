# Validation

89 checks over the pricing model, the full analysis chain and the data layer.
No test framework: each file is a standalone script that exits non-zero on
failure, so it runs anywhere Node and esbuild are available.

| File | Covers |
| --- | --- |
| `model.test.ts` | Event counting rules, trend adjustment, frequency fitting, distributions, money outcomes, pricing identities, volume discount |
| `analysis.test.ts` | Full analysis, peril bundling, projection path and bands, plus a 400-case fuzz over random assumptions |
| `data.test.ts` | Request construction, error handling, rate-limit backoff, climate model parsing, WorldPop polygon and task polling, geometry |

Run one with:

```bash
npx esbuild tests/model.test.ts --bundle --platform=node --outfile=/tmp/t.js && node /tmp/t.js
```

The data tests stub `globalThis.fetch`, so nothing touches the network.
