import React from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SectionHead, Readout, NumberField, SliderField, Pills, Note, Empty, PanelBlock } from './Bits';
import { Assumptions, LocationResult, ProjectionResult, Price, effectiveExpenseRatio, pct } from '../services/RiskModel';
import { Currency, CURRENCIES, money, moneyShort, count } from '../services/Currency';
import { POPULATION_YEAR, BASELINE, FUTURE } from '../services/ClimateData';

export type Peril = 'heat' | 'cold' | 'both';

const HEAT = '#ff7a55';
const COLD = '#6fb4f2';

export const perilLabel: Record<Peril, string> = {
  heat: 'Heat only',
  cold: 'Cold only',
  both: 'Heat and cold',
};

export const pickPrice = (r: LocationResult, p: Peril): Price =>
  p === 'heat' ? r.heat.price : p === 'cold' ? r.cold.price : r.combined;

const axis = { fontSize: 10, fill: 'rgba(247,249,250,0.66)' };
const tooltipStyle = {
  fontSize: 12,
  borderRadius: 3,
  background: '#2b323a',
  borderColor: '#566170',
  color: '#f7f9fa',
};

// ---------------------------------------------------------------------------
// 01 Product
// ---------------------------------------------------------------------------

export const ProductSection: React.FC<{
  a: Assumptions;
  onChange: (a: Assumptions) => void;
  onReset: () => void;
  isDefault: boolean;
  peril: Peril;
  onPerilChange: (p: Peril) => void;
  currency: Currency;
  onCurrencyChange: (code: string) => void;
  book: number;
}> = ({ a, onChange, onReset, isDefault, peril, onPerilChange, currency, onCurrencyChange, book }) => {
  const set = (patch: Partial<Assumptions>) => onChange({ ...a, ...patch });
  const invalid = a.targetCombinedRatio - a.expenseRatio <= 0;

  return (
    <>
      <SectionHead
        index="01 / Product"
        title="Set the policy"
        standfirst="Set the rules of the policy here: how hot or cold it has to get, for how long, and how much it pays. The starting values come from official UK definitions. Everything below updates as you change them."
        aside={
          !isDefault && (
            <button onClick={onReset} className="btn-ghost">Reset</button>
          )
        }
      />

      <div className="section-body space-y-3">

        <PanelBlock
          head="Cover"
          aside={<Pills peril value={peril} onChange={onPerilChange} options={[['heat', 'Heat'], ['cold', 'Cold'], ['both', 'Both']]} />}
        >
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4 items-start">
            {peril !== 'cold' && (
              <SliderField
                label="Pays out when the day reaches"
                value={a.heatThreshold}
                onChange={v => set({ heatThreshold: v })}
                min={20}
                max={45}
                step={0.5}
                unit="°C"
              />
            )}
            {peril !== 'cold' && (
              <SliderField
                label="For this many days in a row"
                value={a.heatDuration}
                onChange={v => set({ heatDuration: Math.round(v) })}
                min={1}
                max={10}
                unit="d"
              />
            )}
            {peril !== 'heat' && (
              <SliderField
                label="Pays out when the day averages"
                value={a.coldThreshold}
                onChange={v => set({ coldThreshold: v })}
                min={-15}
                max={10}
                step={0.5}
                unit="°C"
              />
            )}
            {peril !== 'heat' && (
              <SliderField
                label="Pays again every this many days"
                value={a.coldDuration}
                onChange={v => set({ coldDuration: Math.round(v) })}
                min={1}
                max={21}
                unit="d"
              />
            )}
          </div>
        </PanelBlock>

        <PanelBlock head="Payout and take-up">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4 items-start">
            <NumberField label="Paid out per event" value={a.payoutPerEvent} onChange={v => set({ payoutPerEvent: Math.max(1, v) })} prefix={currency.symbol} min={1} step={25} />
            <label className="block">
              <span className="field-label">Currency</span>
              <select value={currency.code} onChange={e => onCurrencyChange(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
              </select>
            </label>
            <SliderField
              label="Most payouts in one year"
              value={a.annualLimit}
              onChange={v => set({ annualLimit: Math.round(v) })}
              min={1}
              max={12}
              unit=""
            />
            <SliderField
              label="Share of people who buy it"
              value={+(a.adoption * 100).toFixed(2)}
              onChange={v => set({ adoption: v / 100 })}
              min={0.05}
              max={10}
              step={0.05}
              unit="%"
              hint={`${count(book, currency)} customers`}
            />
          </div>
        </PanelBlock>

        <PanelBlock head="How the price is set">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4 items-start">
            <SliderField
              label="Claims and costs as share of price"
              value={Math.round(a.targetCombinedRatio * 100)}
              onChange={v => set({ targetCombinedRatio: v / 100 })}
              min={50}
              max={110}
              unit="%"
            />
            <SliderField
              label="Running costs as share of price"
              value={Math.round(a.expenseRatio * 100)}
              onChange={v => set({ expenseRatio: v / 100 })}
              min={5}
              max={60}
              unit="%"
              hint={invalid ? 'Too high, nothing left for claims' : `Leaves ${pct(a.targetCombinedRatio - a.expenseRatio)} for claims`}
            />
            <div>
              <SliderField
                label="Cost saving each time the book doubles"
                value={+(a.volumeDiscountPerDoubling * 100).toFixed(1)}
                onChange={v => set({ volumeDiscountPerDoubling: v / 100 })}
                min={0}
                max={6}
                step={0.5}
                unit="pp"
                hint={
                  a.volumeDiscountPerDoubling > 0
                    ? `Costs run at ${pct(effectiveExpenseRatio(a, book), 1)} with ${count(book, currency)} customers`
                    : 'Off. Costs stay the same share however many customers you have.'
                }
              />
              {a.volumeDiscountPerDoubling > 0 && (
                <div className="mt-3.5">
                  <NumberField
                    label="Reference book size"
                    value={a.referencePolicies}
                    onChange={v => set({ referencePolicies: Math.max(1, Math.round(v)) })}
                    step={1000}
                    min={1}
                  />
                  <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
                    The number of customers at which the running cost above applies. Every doubling
                    from here takes the saving off, every halving adds it back.
                  </p>
                </div>
              )}
            </div>
            {invalid && (
              <p className="text-xs" style={{ color: HEAT }}>
                Running costs cannot be bigger than claims and costs combined, or there is nothing left to pay claims with.
              </p>
            )}
          </div>
        </PanelBlock>

      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 02 Hazard
// ---------------------------------------------------------------------------

export const RiskSection: React.FC<{
  result: LocationResult | null;
  loading: boolean;
  error: string | null;
  peril: Peril;
  startYear: number;
  endYear: number;
}> = ({ result, loading, error, peril, startYear, endYear }) => {
  const showHeat = peril !== 'cold';
  const showCold = peril !== 'heat';

  const data = result
    ? Array.from(result.heat.observed.keys()).map(y => ({
        year: y,
        Heat: result.heat.observed.get(y) ?? 0,
        Cold: result.cold.observed.get(y) ?? 0,
      }))
    : [];

  const worst = data.reduce(
    (best, d) => {
      const v = (showHeat ? d.Heat : 0) + (showCold ? d.Cold : 0);
      return v > best.v ? { y: d.year, v } : best;
    },
    { y: 0, v: -1 }
  );

  return (
    <>
      <SectionHead
        index="02 / Hazard"
        title="How often it has happened"
        standfirst="How many times your trigger would have fired at this spot, every year since 1991. The adjusted column corrects for the fact that the early years were cooler than today, so old records do not make the risk look smaller than it is."
      />

      <div className="section-body">
        {loading && (
          <div className="panel panel-pad flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <Loader2 className="size-3.5 animate-spin" />
            Reading {endYear - startYear + 1} years of daily temperature
          </div>
        )}
        {error && !loading && (
          <div className="panel panel-pad"><p className="text-xs" style={{ color: HEAT }}>{error}</p></div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            <PanelBlock head="Frequency and warming trend">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Peril</th>
                    <th>Times a year, as it happened</th>
                    <th>Adjusted for warming</th>
                    <th>Warming per decade</th>
                  </tr>
                </thead>
                <tbody>
                  {showHeat && (
                    <tr>
                      <td className="c-heat" style={{ color: HEAT, fontWeight: 600 }}>Heat</td>
                      <td className="c-heat">{result.heat.observedMean.toFixed(2)}</td>
                      <td className="c-heat" style={{ fontWeight: 600 }}>{result.heat.frequency.mean.toFixed(2)}</td>
                      <td className="c-heat">{result.heat.slopePerDecade >= 0 ? '+' : '−'}{Math.abs(result.heat.slopePerDecade).toFixed(2)}°C</td>
                    </tr>
                  )}
                  {showCold && (
                    <tr>
                      <td className="c-cold" style={{ color: COLD, fontWeight: 600 }}>Cold</td>
                      <td className="c-cold">{result.cold.observedMean.toFixed(2)}</td>
                      <td className="c-cold" style={{ fontWeight: 600 }}>{result.cold.frequency.mean.toFixed(2)}</td>
                      <td className="c-cold">{result.cold.slopePerDecade >= 0 ? '+' : '−'}{Math.abs(result.cold.slopePerDecade).toFixed(2)}°C</td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ color: 'var(--muted)' }}>Worst year on record</td>
                    <td>{worst.v > 0 ? worst.y : '—'}</td>
                    <td>{worst.v > 0 ? `${worst.v} event${worst.v === 1 ? '' : 's'}` : '—'}</td>
                    <td>{result.heat.frequency.model}</td>
                  </tr>
                </tbody>
              </table>
            </PanelBlock>

            <PanelBlock head="Times the trigger fired, each year">
              <div className="h-44 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={{ stroke: '#333940' }} interval={3} />
                    <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={22} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#eef1f2' }} labelStyle={{ color: 'rgba(247,249,250,0.7)' }} cursor={{ fill: 'rgba(247,249,250,0.06)' }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    {showHeat && <Bar dataKey="Heat" fill={HEAT} />}
                    {showCold && <Bar dataKey="Cold" fill={COLD} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PanelBlock>
          </div>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 03 Price
// ---------------------------------------------------------------------------

export const PriceSection: React.FC<{
  result: LocationResult | null;
  peril: Peril;
  a: Assumptions;
  currency: Currency;
}> = ({ result, peril, a, currency }) => {
  if (!result) {
    return (
      <>
        <SectionHead index="03 / Price" title="What to charge" />
        <div className="section-body"><Empty>Waiting for the temperature record.</Empty></div>
      </>
    );
  }

  const showHeat = peril !== 'cold';
  const showCold = peril !== 'heat';
  const showBoth = peril === 'both';
  const sel = pickPrice(result, peril);
  const separateTail = result.heat.price.tailPayout + result.cold.price.tailPayout;

  const rows: Array<{ label: string; pick: (p: Price) => string; strong?: boolean }> = [
    { label: 'Payouts in a normal year', pick: p => money(p.expectedPayout, currency) },
    { label: 'Running costs', pick: p => money(p.expenses, currency) },
    { label: 'Profit', pick: p => money(p.margin, currency) },
    { label: 'Yearly price', pick: p => money(p.premium, currency), strong: true },
    { label: 'Share spent on claims', pick: p => pct(p.lossRatio) },
    { label: 'Share spent on costs', pick: p => pct(p.expenseRatio) },
    { label: 'Payout in a 1-in-200 year', pick: p => money(p.tailPayout, currency, 0) },
    { label: 'Money held in reserve', pick: p => money(p.capital, currency, 0) },
    { label: 'Return on that reserve', pick: p => pct(p.returnOnCapital) },
  ];

  const cell = (p: Price, f: (p: Price) => string) => (p.priceable ? f(p) : '—');

  return (
    <>
      <SectionHead
        index="03 / Price"
        title="What to charge"
        standfirst={`The yearly price per customer. It is set so that ${pct(a.targetCombinedRatio)} of the premium goes on claims and running costs, leaving the rest as profit. Capital is the spare money an insurer must hold back for a very bad year.`}
      />

      <div className="section-body space-y-3">
        <Readout
          items={[
            { label: 'Yearly price', value: sel.priceable ? money(sel.premium, currency) : '—', note: perilLabel[peril] },
            { label: 'Share spent on claims', value: sel.priceable ? pct(sel.lossRatio) : '—', note: 'UK car insurance: 54%. Home: 46%' },
            { label: 'Payout in a 1-in-200 year', value: sel.priceable ? money(sel.tailPayout, currency, 0) : '—' },
            { label: 'Money held in reserve', value: sel.priceable ? money(sel.capital, currency, 0) : '—' },
            { label: 'Return on that reserve', value: sel.priceable ? pct(sel.returnOnCapital) : '—' },
          ]}
        />

        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Per customer, per year</th>
                {showHeat && <th className="c-heat" style={{ color: HEAT }}>Heat</th>}
                {showCold && <th className="c-cold" style={{ color: COLD }}>Cold</th>}
                {showBoth && <th>Both</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} data-strong={r.strong}>
                  <td style={{ color: r.strong ? 'var(--ink)' : 'var(--muted)' }}>{r.label}</td>
                  {showHeat && <td className="c-heat">{cell(result.heat.price, r.pick)}</td>}
                  {showCold && <td className="c-cold">{cell(result.cold.price, r.pick)}</td>}
                  {showBoth && <td>{cell(result.combined, r.pick)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {((showHeat && !result.heat.price.priceable) || (showCold && !result.cold.price.priceable)) && (
          <Note>A dash means this trigger never fired in the whole record. That does not mean it is impossible, only that there is nothing here to base a price on.</Note>
        )}
        {showBoth && result.heat.price.priceable && result.cold.price.priceable && (
          <Note>
            Selling heat and cold together costs the same as selling them apart, because the expected
            payouts simply add up. What it does change is the worst case. A brutal summer and a brutal
            winter almost never land in the same year, so the 1-in-200 payout drops from{' '}
            {money(separateTail, currency, 0)} to {money(result.combined.tailPayout, currency, 0)}. Same
            price, less money tied up in reserve.
          </Note>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 04 Outlook
// ---------------------------------------------------------------------------

export const OutlookSection: React.FC<{
  result: LocationResult | null;
  projection: ProjectionResult | null;
  loading: boolean;
  error: string | null;
  peril: Peril;
  currency: Currency;
  onRun: () => void;
  hasRun: boolean;
}> = ({ result, projection, loading, error, peril, currency, onRun, hasRun }) => {
  const showHeat = peril !== 'cold';
  const showCold = peril !== 'heat';
  const now = result ? pickPrice(result, peril) : null;
  const future =
    projection === null ? null : peril === 'heat' ? projection.heatPremium : peril === 'cold' ? projection.coldPremium : projection.combinedPremium;
  const change = now && now.premium > 0 && future != null ? future / now.premium - 1 : null;

  return (
    <>
      <SectionHead
        index="06 / Outlook"
        title="The price in 2050"
        standfirst={`What the same policy would cost in a warmer world. Climate models run slightly hot or cold against real weather, so each one is compared against its own past rather than against reality, which cancels that bias out. You do not need this to price a policy for next year. You need it to decide whether to launch the product at all.`}
        aside={
          !hasRun && !loading ? (
            <button onClick={onRun} className="btn-solid inline-flex items-center gap-1.5">
              Run projection <ArrowRight className="size-3" />
            </button>
          ) : undefined
        }
      />

      <div className="section-body space-y-3">
        {!hasRun && !loading && !error && (
          <Empty>This pulls fifty years of daily forecasts from two climate models, which is by far the slowest thing on the page. It only runs when you ask, so it can never hold up the pricing above.</Empty>
        )}
        {loading && (
          <div className="panel panel-pad flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <Loader2 className="size-3.5 animate-spin" /> Running projection
          </div>
        )}
        {error && !loading && (
          <div className="panel panel-pad flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{error}</p>
            <button onClick={onRun} className="btn-ghost shrink-0">Retry</button>
          </div>
        )}

        {projection && result && !loading && (
          <>
            <Readout
              items={[
                { label: 'Price today', value: now?.priceable ? money(now.premium, currency) : '—' },
                { label: `Price in ${FUTURE.start}–${FUTURE.end}`, value: future != null ? money(future, currency) : '—', accent: change != null && change > 0 ? HEAT : undefined },
                { label: 'Change', value: change != null ? `${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)}%` : '—', accent: change != null && change > 0 ? HEAT : COLD },
              ]}
            />
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Peril</th>
                    <th>Change in how often</th>
                    <th>Price today</th>
                    <th>Price then</th>
                  </tr>
                </thead>
                <tbody>
                  {showHeat && (
                    <tr>
                      <td className="c-heat" style={{ color: HEAT, fontWeight: 600 }}>Heat</td>
                      <td className="c-heat">{projection.heatScale != null ? `${projection.heatScale >= 1 ? '+' : ''}${((projection.heatScale - 1) * 100).toFixed(0)}%` : 'n/a'}</td>
                      <td>{result.heat.price.priceable ? money(result.heat.price.premium, currency) : '—'}</td>
                      <td>{projection.heatPremium != null ? money(projection.heatPremium, currency) : '—'}</td>
                    </tr>
                  )}
                  {showCold && (
                    <tr>
                      <td className="c-cold" style={{ color: COLD, fontWeight: 600 }}>Cold</td>
                      <td className="c-cold">{projection.coldScale != null ? `${projection.coldScale >= 1 ? '+' : ''}${((projection.coldScale - 1) * 100).toFixed(0)}%` : 'n/a'}</td>
                      <td>{result.cold.price.priceable ? money(result.cold.price.premium, currency) : '—'}</td>
                      <td>{projection.coldPremium != null ? money(projection.coldPremium, currency) : '—'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Note>Heat and cold move in opposite directions as the world warms, so selling only heat cover leaves you exposed to a cost that keeps climbing, while selling both balances out. These projections assume high emissions, so treat them as the worse end of the range.</Note>
          </>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// 05 Portfolio
// ---------------------------------------------------------------------------

export const PortfolioSection: React.FC<{
  result: LocationResult | null;
  peril: Peril;
  a: Assumptions;
  currency: Currency;
  population: number | null;
  policies: number | null;
  loading: boolean;
  error: string | null;
  onManualPopulation: (n: number) => void;
}> = ({ result, peril, a, currency, population, policies, loading, error, onManualPopulation }) => {
  const [manual, setManual] = React.useState('');
  const sel = result ? pickPrice(result, peril) : null;
  const n = policies ?? 0;

  return (
    <>
      <SectionHead
        index="04 / Portfolio"
        title="Selling it at scale"
        standfirst="What it looks like if you sell this across a whole city. Because every customer is covered by the same thermometer reading, they all get paid on the same day. That is why the worst-year figure is simply one customer multiplied by all of them."
      />

      <div className="section-body space-y-3">
        {loading && (
          <div className="panel panel-pad flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <Loader2 className="size-3.5 animate-spin" /> Estimating population
          </div>
        )}

        {!loading && population === null && (
          <div className="panel panel-pad max-w-sm">
            <p className="text-xs mb-2.5" style={{ color: 'var(--muted)' }}>
              {error ? 'Population service unavailable. Enter a figure for this area.' : 'Enter a population for this area.'}
            </p>
            <div className="flex gap-2">
              <input type="number" min={0} placeholder="9000000" value={manual} onChange={e => setManual(e.target.value)} />
              <button
                onClick={() => {
                  const v = parseFloat(manual);
                  if (isFinite(v) && v > 0) onManualPopulation(Math.round(v));
                }}
                className="btn-solid shrink-0"
              >
                Use
              </button>
            </div>
          </div>
        )}

        {!loading && population !== null && sel && (
          <>
            <Readout
              items={[
                { label: `People living here, ${POPULATION_YEAR}`, value: count(population, currency) },
                { label: 'Customers', value: count(n, currency), note: `${pct(a.adoption, a.adoption < 0.01 ? 2 : 1)} of people buy it` },
                { label: 'Money taken in', value: sel.priceable ? moneyShort(n * sel.premium, currency) : '—' },
                { label: 'Paid out in a normal year', value: moneyShort(n * sel.expectedPayout, currency) },
                { label: 'Paid out in a 1-in-200 year', value: moneyShort(n * sel.tailPayout, currency), accent: HEAT },
                { label: 'Money held in reserve', value: moneyShort(n * sel.capital, currency) },
              ]}
            />
            <Note>The weather data covers squares roughly 9 to 25 km across, so one reading stands for the whole area. Spreading risk means selling in cities whose weather does not move together, not selling more in one city.</Note>
          </>
        )}
      </div>
    </>
  );
};
