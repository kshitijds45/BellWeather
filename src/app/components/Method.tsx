import React from 'react';
import { TOOL_NAME, CREATOR } from '../branding';
import { DEFAULTS } from '../services/RiskModel';
import { HISTORY_START, historyEnd, BASELINE, FUTURE, CLIMATE_MODELS, POPULATION_YEAR } from '../services/ClimateData';

/**
 * Method, grouped to match the analysis sections rather than by topic, so
 * anyone questioning a figure on screen can jump to the panel it came from.
 */

const YEARS = historyEnd() - HISTORY_START + 1;
const pc = (v: number) => `${Math.round(v * 100)}%`;

const Group: React.FC<{ index: string; title: string; children: React.ReactNode }> = ({
  index,
  title,
  children,
}) => (
  <section className="pt-7 mt-7" style={{ borderTop: '1px solid var(--rule-strong)' }}>
    <p className="section-index">{index}</p>
    <h3 className="mt-1 mb-4" style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.025em' }}>
      {title}
    </h3>
    {children}
  </section>
);

const Sub: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mt-5">
    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 7 }}>{title}</h4>
    {children}
  </div>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--ink-soft)' }}>
    {children}
  </p>
);

const F: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="text-xs px-3 py-2.5 rounded-sm my-3 leading-relaxed"
    style={{ background: 'var(--void)', border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
  >
    {children}
  </div>
);

const Table: React.FC<{ head: string[]; rows: string[][] }> = ({ head, rows }) => (
  <div className="panel overflow-x-auto my-3">
    <table className="data-table">
      <thead>
        <tr>{head.map((h, i) => <th key={h} style={i === 0 ? undefined : { textAlign: 'left' }}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r[0]}>
            {r.map((c, i) => (
              <td key={i} style={{ textAlign: 'left', color: i === 0 ? 'var(--ink)' : 'var(--ink-soft)' }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const Method: React.FC = () => (
  <div className="h-full overflow-y-auto px-5 py-7 md:px-10 md:py-10">
    <div className="mx-auto pb-24 pt-2" style={{ maxWidth: 860 }}>

      <p className="section-index">Method</p>
      <h2 className="mt-1" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>
        Sources, formulas and limits
      </h2>
      <p className="text-sm mt-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
        Grouped to match the analysis panels, so any figure on screen can be traced to the method
        behind it. Every request URL is written to the browser console, so the underlying data can be
        checked independently.
      </p>

      {/* ------------------------------------------------------------------ */}
      <Group index="01 / Product" title="What is being priced">
        <P>
          Parametric cover pays a fixed sum when a temperature index crosses a defined line. There is
          no claim, no inspection and no loss adjuster, because there is nothing to assess. This is
          what makes the product priceable from temperature data alone: a conventional policy needs a
          model of damage, whereas here the payout is fixed by contract, so the only uncertainty is
          how often the trigger fires.
        </P>

        <Sub title="Trigger definitions">
          <P>
            Both defaults are official UK definitions rather than judgement, which matters because a
            trigger a counterparty recognises is far easier to sell and to defend.
          </P>
          <Table
            head={['Peril', 'Default', 'Source']}
            rows={[
              ['Heatwave', `${DEFAULTS.heatDuration}+ consecutive days with a daily maximum at or above ${DEFAULTS.heatThreshold}°C`, 'Met Office heatwave definition. 28°C is the Greater London threshold'],
              ['Cold wave', `Each run of ${DEFAULTS.coldDuration} consecutive days with a daily mean at or below ${DEFAULTS.coldThreshold}°C`, 'UK Cold Weather Payment trigger, itself effectively a parametric scheme'],
            ]}
          />
          <P>
            Counting differs between the two, following each scheme. A qualifying heat run is one
            heatwave however long it lasts, and a new run after a break is a new event. For cold,
            each full run pays, so a fourteen day spell at the seven day setting pays twice.
          </P>
        </Sub>

        <Sub title="What each control does">
          <Table
            head={['Control', 'Effect']}
            rows={[
              ['Payout per event', 'Scales every money figure. Leaves every ratio unchanged, so it sets the size of the product, not its economics'],
              ['Annual limit', 'Caps events paid per peril per year, which caps the worst case per policy and therefore the capital'],
              ['Adoption rate', 'Policies in force as a share of the area population. Affects the portfolio, and the price only if a volume discount is set'],
              ['Target combined ratio', 'Claims plus expenses as a share of premium. What the premium is solved to hit'],
              ['Expense ratio', 'The share of premium consumed by expenses at the reference book size'],
              ['Volume discount', 'Percentage points removed from the expense ratio per doubling of the book'],
              ['Reference book size', 'The book size at which the stated expense ratio applies. The anchor point of the discount curve'],
            ]}
          />
        </Sub>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="02 / Hazard" title="How often the trigger fires">
        <Sub title="Data">
          <P>
            Daily maximum and mean temperature from the Open-Meteo Historical Weather API, which
            serves ECMWF reanalysis at 9 to 25 km. The record runs {HISTORY_START} to {historyEnd()}.
            It starts in {HISTORY_START} to match the 1991 to 2020 climate normal the Met Office uses
            for its current thresholds, and ends at the last complete calendar year because the
            archive lags real time by several days. Temperature is read at one index point, the
            centre of the chosen area.
          </P>
        </Sub>

        <Sub title="Trend adjustment">
          <P>
            A plain average over {YEARS} years underprices heat and overprices cold, because the early
            years were cooler than today. Removing a linear trend before pricing is the standard
            correction for weather contracts, since both warming and urbanisation push historical
            temperature records upward.
          </P>
          <F>
            Take the mean summer maximum (June to August) for heat, or the mean winter temperature
            (December to February) for cold, for each year.
            <br />
            Fit a straight line through those yearly means.
            <br />
            Shift every day in each year by the gap between that year's point on the line and the
            final year's.
            <br />
            Count events again on the shifted record.
          </F>
          <P>
            Summer and winter are treated separately because they do not warm at the same rate. The
            panel shows both figures: the record as it happened, and the adjusted version the pricing
            uses.
          </P>
        </Sub>

        <Sub title="Frequency distribution">
          <P>
            {YEARS} years cannot show a 1-in-200 year directly, so a count distribution is fitted to
            the adjusted events per year and the tail is read from the distribution rather than the
            record. Where the year to year spread roughly equals the average, a Poisson is used.
            Where it is noticeably larger, a negative binomial is used instead. That second case is
            common for heat, because the conditions producing one heatwave tend to produce several in
            the same summer, and the negative binomial gives that clustering a heavier tail.
          </P>
        </Sub>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="03 / Price" title="How the rate is built">
        <Sub title="Premium">
          <P>
            The premium is solved so the combined ratio lands on the target. The combined ratio is
            claims plus expenses as a share of premium, and anything below 100% is underwriting
            profit.
          </P>
          <F>
            combined ratio = loss ratio + expense ratio
            <br />
            {pc(DEFAULTS.targetCombinedRatio)} = {pc(DEFAULTS.targetCombinedRatio - DEFAULTS.expenseRatio)} + {pc(DEFAULTS.expenseRatio)}
            <br />
            <br />
            premium = expected payout ÷ loss ratio
            <br />
            expenses = premium × expense ratio
            <br />
            margin = premium × (1 − combined ratio)
          </F>
          <P>
            Expected payout is the mean number of paid events a year, from the fitted distribution,
            multiplied by the payout per event.
          </P>
        </Sub>

        <Sub title="Reading the loss ratio">
          <P>
            The FCA publishes claims costs as a proportion of premium for every retail insurance
            product sold in the UK. In its 2024 data that was 54% for motor and 46% for home, while
            products it has criticised for poor value sat far lower: 4% for GAP sold as an add-on and
            around 9% for annual European travel cover. A parametric product is structurally closest
            to travel and personal accident, which is exactly where those low ratios cluster, so
            pricing to a loss ratio near motor and home is a deliberate position.
          </P>
        </Sub>

        <Sub title="Volume discount">
          <P>
            Expenses are a flat share of premium by default, which assumes a small book costs the
            same per policy to run as a large one. Commission and per-policy admin do scale with the
            book, but platform, compliance and actuarial costs are largely fixed. Rather than guess
            an insurer's cost structure, the tool lets the underwriter apply their own curve,
            expressed as points off the expense ratio per doubling, which is the shape real scale
            effects take.
          </P>
          <F>
            expense ratio = base − discount × log₂(policies ÷ reference book size)
          </F>
          <P>
            The curve works in both directions, so a book smaller than the reference is charged more.
            The result is floored so expenses never vanish and capped so claims always retain a share.
          </P>
        </Sub>

        <Sub title="Capital check">
          <P>
            Pricing to a fixed combined ratio gives every location the same margin however lumpy its
            risk. The capital check shows where that margin is not enough.
          </P>
          <F>
            1-in-200 year payout = payout at the 99.5th percentile of the fitted distribution
            <br />
            capital needed = 1-in-200 year payout − expected payout
            <br />
            return on capital = margin ÷ capital needed
          </F>
          <P>
            The 99.5% level is the Solvency II and Solvency UK standard: enough capital to survive
            all but one year in two hundred. A low return on capital is the signal to raise the price,
            lower the limit or decline the risk.
          </P>
        </Sub>

        <Sub title="Writing both perils">
          <P>
            Bundling does not change the premium, because expected claims simply add. It changes the
            tail. A severe summer and a severe winter are treated as independent, so the combined
            1-in-200 payout is lower than the sum of the two, and the same premium is earned against
            less capital. Bundling perils is a capital story, not a pricing story.
          </P>
        </Sub>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="04 / Portfolio" title="Scaling to a book">
        <P>
          Population inside the drawn area comes from WorldPop, {POPULATION_YEAR} estimate, on a 100 m
          grid. If that service does not respond, a figure can be entered by hand.
        </P>
        <F>
          policies in force = population × adoption rate
          <br />
          premium income = policies × annual premium
          <br />
          1-in-200 year payout = policies × 1-in-200 year payout per policy
        </F>
        <P>
          The last line is a straight multiplication, and that is the most important fact about this
          product. Every policy in the area pays on the same index reading, so they all trigger
          together. There is no diversification inside an area: a hundred thousand policies are one
          risk, a hundred thousand times over. Diversification comes only from writing in places
          whose weather does not move together.
        </P>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="05 / Sensitivity" title="Testing a parameter">
        <P>
          One parameter is swept across a range while everything else is held fixed, reporting the
          premium, loss ratio, tail and portfolio effect at each step. Every row is a full
          recalculation across the whole temperature record rather than an interpolation, so moving a
          trigger by a degree genuinely re-counts every event in {YEARS} years of daily data.
        </P>
        <P>
          Holding everything else constant is both the method and its limitation. Real decisions move
          several parameters at once and a one-at-a-time sweep cannot show the interactions. Where a
          row shows a dash, no qualifying event survives at that setting, which marks the point at
          which the trigger stops being insurable from this record.
        </P>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="06 / Outlook" title="Repricing on future climate">
        <P>
          Daily temperature to {FUTURE.end} from the Open-Meteo Climate API: CMIP6 HighResMIP
          downscaled to 10 km, {CLIMATE_MODELS.length} models. Climate models run warm or cold against
          observed weather, so their event counts are not used directly. Each model is compared with
          itself: its event rate over {FUTURE.start} to {FUTURE.end} against its own rate over{' '}
          {BASELINE.start} to {BASELINE.end}. That ratio is averaged across models and applied to the
          adjusted historical frequency, so most of each model's bias cancels and only the change
          carries through.
        </P>
        <P>
          These runs follow a high emissions pathway, so read the figure as nearer an upper case than
          a central estimate. It is not needed to price a one-year contract. It tells an insurer
          whether the product stays viable, which matters before committing to launch. It also runs
          only on request, because fifty years of daily output across two models is heavy enough to
          exhaust the provider's per-minute allowance and would otherwise delay the pricing.
        </P>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="Limits" title="What this cannot tell you">
        <ul className="text-sm space-y-2.5" style={{ color: 'var(--ink-soft)' }}>
          <li>
            <strong>Basis risk.</strong> The index is one grid point. A policyholder can suffer on a
            day the index misses, or be paid on a day they were fine. Every parametric product carries
            this and it is the main thing a buyer needs to understand.
          </li>
          <li>
            <strong>No settlement source.</strong> A real contract names a specific station or dataset
            as binding, with fallbacks. Reanalysis is right for analysis and wrong for a contract.
          </li>
          <li>
            <strong>Reanalysis is modelled.</strong> It blends observations with a weather model and
            runs smoother than a thermometer, so extremes at a single station can be sharper.
          </li>
          <li>
            <strong>One point for the whole area.</strong> A large area has real temperature variation
            that a single index point ignores.
          </li>
          <li>
            <strong>Population is from {POPULATION_YEAR}</strong>, the latest WorldPop year, and
            adoption is an assumption rather than a forecast.
          </li>
          <li>
            <strong>Thin history for rare perils.</strong> Where a trigger fired only a handful of
            times the fitted distribution rests on very little. Cold cover in a mild city is the
            obvious case.
          </li>
          <li>
            <strong>Not a quotation.</strong> Nobody has underwritten anything here.
          </li>
        </ul>
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="Provenance" title="Where each assumption comes from">
        <P>
          Not every input carries the same weight of evidence, so each is labelled by what stands
          behind it.
        </P>
        <Table
          head={['Input', 'Evidence', 'Basis']}
          rows={[
            ['Heat trigger', 'Official', 'Met Office heatwave definition, Greater London threshold'],
            ['Cold trigger', 'Official', 'UK Cold Weather Payment scheme'],
            ['99.5% capital standard', 'Official', 'Solvency II and Solvency UK'],
            ['Loss ratio benchmark', 'Official', 'FCA general insurance value measures, 2024'],
            ['Expense ratio', 'Indicative', 'Within the range typical of UK personal lines. Not published for this product'],
            ['Volume discount', 'Your input', 'No public data exists on insurer unit costs. Off by default'],
            ['Payout, limit, adoption', 'Your input', 'Product design choices, not findings'],
          ]}
        />
      </Group>

      {/* ------------------------------------------------------------------ */}
      <Group index="Credits" title="Attribution">
        <P>
          Weather and climate data from Open-Meteo, used under its non-commercial terms. Historical
          data generated using Copernicus Climate Change Service information via ECMWF. Climate
          projections from CMIP6 HighResMIP, CC BY 4.0. Population from WorldPop, University of
          Southampton. Maps and place search from OpenStreetMap contributors, ODbL.
        </P>
        <p className="text-xs mt-5 pt-5" style={{ color: 'var(--muted)', borderTop: '1px solid var(--rule)' }}>
          {TOOL_NAME} was designed and built by {CREATOR}. It began as a business school submission on
          urban heat resilience and was extended into a working pricing model.
        </p>
      </Group>

    </div>
  </div>
);
