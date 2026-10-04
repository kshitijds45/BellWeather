# Validation

162 checks over the pricing model, the full analysis chain, the data layer and
the interface. No test framework: each file is a standalone script that exits
non-zero on failure, so it runs anywhere Node and esbuild are available.

| File | Checks | Covers |
| --- | --- | --- |
| `model.test.ts` | 55 | Event counting rules, trend adjustment, frequency fitting, distributions, money outcomes, pricing identities, volume discount, and the heat trigger read from local climate |
| `analysis.test.ts` | 23 | Full analysis, peril bundling, projection path and bands, plus a 400-case fuzz over random assumptions |
| `data.test.ts` | 29 | Request construction, error handling, rate-limit backoff, population polling latency and caching, climate model parsing, WorldPop polygon and task polling, geometry |
| `ui.test.ts` | 55 | Axis ticks always keep the final year, the outlook tooltip renders the confidence band as a range, a slider reaches every value its typed box accepts and its track fills the row its labels are measured against, a readout cell is never squeezed under the figure it holds, the policy terms read as one sentence and carry the annual limit and the currency, the pinned results strip labels its scales and survives every data state, and the guide sits as a card over the console, argues the need with named cases and real precedents, and stays in step with it |

Run one with:

```bash
npx esbuild tests/model.test.ts --bundle --platform=node --outfile=/tmp/t.js && node /tmp/t.js
```

`ui.test.ts` renders components, so it needs the JSX flag and a stylesheet
loader, because the guide imports its own CSS:

```bash
npx esbuild tests/ui.test.ts --bundle --platform=node --jsx=automatic --loader:.css=empty --outfile=/tmp/t.js && node /tmp/t.js
```

Run from the repository root. `ui.test.ts` reads `src/styles/app-theme.css`
to check a layout rule that cannot be seen in the markup.

The data tests stub `globalThis.fetch`, so nothing touches the network.
