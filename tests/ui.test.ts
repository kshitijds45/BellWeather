/**
 * Presentation checks.
 *
 * These cover the things that are easy to get wrong in the interface and
 * impossible to see from the model tests: which years get an axis label,
 * whether the confidence band renders as a range rather than a dash, and
 * whether a slider reaches every value its typed box accepts.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  yearTicks,
  OutlookTooltip,
  ProductSection,
  MAX_HEAT_C,
  MIN_COLD_C,
  clampHeat,
  clampCold,
  ResultStrip,
} from '../src/app/components/Sections';
import { DEFAULTS, analyse } from '../src/app/services/RiskModel';
import { Tour } from '../src/app/components/Tour';
import { CURRENCIES } from '../src/app/services/Currency';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => string | null) {
  let note: string | null = null;
  try {
    note = fn();
  } catch (e) {
    note = `threw ${(e as Error).message}`;
  }
  if (note === null) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}  ${note}`);
  }
}

const eq = (a: unknown, b: unknown, what: string) =>
  JSON.stringify(a) === JSON.stringify(b) ? null : `${what}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`;

const GBP = CURRENCIES[0];

// ---------------------------------------------------------------------------
// Axis ticks
// ---------------------------------------------------------------------------

check('Hazard window 1991-2025 keeps the final year', () => {
  const t = yearTicks(1991, 2025, 5);
  if (t[t.length - 1] !== 2025) return `last tick is ${t[t.length - 1]}`;
  if (t[0] !== 1991) return `first tick is ${t[0]}`;
  return null;
});

check('Hazard ticks are evenly spaced apart from the end', () => {
  const t = yearTicks(1991, 2025, 5);
  return eq(t, [1991, 1996, 2001, 2006, 2011, 2016, 2021, 2025], 'ticks');
});

check('Outlook window 2031-2050 keeps 2050', () => {
  const t = yearTicks(2031, 2050, 5);
  return eq(t, [2031, 2036, 2041, 2046, 2050], 'ticks');
});

check('A final year that lands on the step is not duplicated', () => {
  const t = yearTicks(2030, 2050, 5);
  return eq(t, [2030, 2035, 2040, 2045, 2050], 'ticks');
});

check('A final year one off the step replaces the tick before it', () => {
  // 2031..2047: forward ticks end at 2046, one year short, so 2046 is dropped
  // rather than printed on top of 2047.
  const t = yearTicks(2031, 2047, 5);
  return eq(t, [2031, 2036, 2041, 2047], 'ticks');
});

check('Every tick sits inside the window', () => {
  for (let start = 1990; start <= 2000; start++) {
    for (let end = start; end <= start + 60; end++) {
      const t = yearTicks(start, end, 5);
      if (t.some(y => y < start || y > end)) return `window ${start}-${end} produced ${t}`;
      if (t.length && t[t.length - 1] !== end) return `window ${start}-${end} lost its end year`;
      const dupes = new Set(t).size !== t.length;
      if (dupes) return `window ${start}-${end} produced duplicates ${t}`;
      for (let i = 1; i < t.length; i++) {
        if (t[i] <= t[i - 1]) return `window ${start}-${end} is not ascending: ${t}`;
      }
    }
  }
  return null;
});

check('A single-year window yields that one year', () => eq(yearTicks(2025, 2025, 5), [2025], 'ticks'));

check('A reversed or non-finite window yields nothing', () => {
  if (yearTicks(2030, 2020, 5).length) return 'reversed window produced ticks';
  if (yearTicks(NaN, 2020, 5).length) return 'NaN start produced ticks';
  return null;
});

// ---------------------------------------------------------------------------
// Outlook tooltip
// ---------------------------------------------------------------------------

const render = (row: unknown, active = true) =>
  renderToStaticMarkup(
    React.createElement(OutlookTooltip, {
      active,
      label: 2050,
      payload: [{ payload: row as never }],
      currency: GBP,
    })
  );

check('Tooltip prints the band as a range, not a dash', () => {
  const html = render({ year: 2050, smoothed: 220, raw: 240, band: [180, 265] });
  if (!html.includes('£180') || !html.includes('£265')) return `band missing from ${html}`;
  if (html.includes('>-<')) return 'tooltip still renders a bare dash';
  return null;
});

check('Tooltip never emits the non-finite dash money() falls back to', () => {
  const html = render({ year: 2050, smoothed: 220, raw: 240, band: [180, 265] });
  // money() returns '-' for NaN; the old formatter coerced the [lo,hi] tuple.
  const dashes = html.split('>-<').length - 1;
  return dashes === 0 ? null : `${dashes} dash cells rendered`;
});

check('Tooltip shows the year, the trend and the model average', () => {
  const html = render({ year: 2050, smoothed: 220, raw: 240, band: [180, 265] });
  for (const want of ['2050', 'Trend', '£220', 'Model average', '£240', '95% range']) {
    if (!html.includes(want)) return `missing ${want}`;
  }
  return null;
});

check('Tooltip omits rows the projection could not price', () => {
  const html = render({ year: 2050, smoothed: undefined, raw: 240, band: undefined });
  if (html.includes('95% range')) return 'band row shown with no band';
  if (html.includes('Trend')) return 'trend row shown with no trend';
  if (!html.includes('£240')) return 'model average dropped';
  return null;
});

check('Tooltip renders nothing when inactive or empty', () => {
  if (render({ year: 2050, smoothed: 220 }, false) !== '') return 'rendered while inactive';
  if (render(undefined) !== '') return 'rendered with no row';
  if (render({ year: 2050 }) !== '') return 'rendered with no series values';
  return null;
});

check('Tooltip respects the chosen currency', () => {
  const inr = CURRENCIES.find(c => c.code === 'INR')!;
  const html = renderToStaticMarkup(
    React.createElement(OutlookTooltip, {
      active: true,
      label: 2050,
      payload: [{ payload: { year: 2050, smoothed: 220, band: [180, 265] } as never }],
      currency: inr,
    })
  );
  return html.includes('₹180') && html.includes('₹265') ? null : `wrong currency in ${html}`;
});

// ---------------------------------------------------------------------------
// Trigger temperature range
//
// The slider and the typed box must cover exactly the same set of values. If
// the box reaches further than the track, dragging silently rewrites a typed
// figure and the extra range is unreachable by mouse.
// ---------------------------------------------------------------------------

check('Heat clamps to the slider track at both ends', () => {
  if (clampHeat(60) !== 60) return `60 became ${clampHeat(60)}`;
  if (clampHeat(75) !== MAX_HEAT_C) return `75 became ${clampHeat(75)}`;
  if (clampHeat(-5) !== 0) return `-5 became ${clampHeat(-5)}`;
  if (clampHeat(28) !== 28) return 'an ordinary value was altered';
  return null;
});

check('Cold clamps to the slider track at both ends', () => {
  if (clampCold(-90) !== -90) return `-90 became ${clampCold(-90)}`;
  if (clampCold(-120) !== MIN_COLD_C) return `-120 became ${clampCold(-120)}`;
  if (clampCold(5) !== 0) return `5 became ${clampCold(5)}`;
  if (clampCold(-6) !== -6) return 'an ordinary value was altered';
  return null;
});

check('A non-finite entry falls back to zero rather than NaN', () => {
  if (!Number.isFinite(clampHeat(NaN))) return 'heat produced a non-finite value';
  if (!Number.isFinite(clampCold(NaN))) return 'cold produced a non-finite value';
  return null;
});

check('Clamping is idempotent, so dragging never walks the value', () => {
  for (let v = -150; v <= 150; v += 0.5) {
    if (clampHeat(clampHeat(v)) !== clampHeat(v)) return `heat moved again at ${v}`;
    if (clampCold(clampCold(v)) !== clampCold(v)) return `cold moved again at ${v}`;
  }
  return null;
});

check('Every value the box accepts survives the slider unchanged', () => {
  // Anything already inside the range must pass through untouched, which is
  // what makes the track and the box interchangeable.
  for (let v = 0; v <= MAX_HEAT_C; v += 0.5) {
    if (clampHeat(v) !== v) return `heat ${v} came back as ${clampHeat(v)}`;
  }
  for (let v = MIN_COLD_C; v <= 0; v += 0.5) {
    if (clampCold(v) !== v) return `cold ${v} came back as ${clampCold(v)}`;
  }
  return null;
});

// ---------------------------------------------------------------------------
// Policy terms sentence
// ---------------------------------------------------------------------------

const product = (peril: 'heat' | 'cold' | 'both') =>
  renderToStaticMarkup(
    React.createElement(ProductSection, {
      a: DEFAULTS,
      onChange: () => {},
      onReset: () => {},
      isDefault: true,
      peril,
      onPerilChange: () => {},
      currency: GBP,
      onCurrencyChange: () => {},
      localHeatTrigger: 25,
      onUseLocalHeatTrigger: () => {},
    })
  );

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

/** Some layout rules cannot be seen in the markup, so they are read from the
 *  stylesheet instead. Run from the repository root. */
const readCss = () => require('fs').readFileSync('src/styles/app-theme.css', 'utf8') as string;

const inOrder = (text: string, parts: string[]) => {
  let at = 0;
  for (const p of parts) {
    const i = text.indexOf(p, at);
    if (i === -1) return `"${p}" missing or out of order`;
    at = i + p.length;
  }
  return null;
};

check('Heat terms read as one sentence, amount first', () =>
  inOrder(plain(product('heat')), ['Pay £', 'for every', 'consecutive days reaching', '°C or above']));

check('Cold terms read as one sentence, amount first', () =>
  inOrder(plain(product('cold')), ['Pay £', 'for every', 'consecutive days averaging', '°C or below']));

check('Each peril states its own measure', () => {
  const heat = plain(product('heat'));
  const cold = plain(product('cold'));
  // "reaching" is the daily maximum, "averaging" the daily mean. Swapping them
  // would describe a different index from the one the model counts.
  if (heat.includes('averaging')) return 'heat sentence claims an average';
  if (cold.includes('reaching')) return 'cold sentence claims a peak';
  return null;
});

check('Every figure in the sentence keeps an accessible name', () => {
  const html = product('both');
  for (const name of [
    'Heat payout each time',
    'Heat block length in days',
    'Heat trigger temperature, typed',
    'Cold payout each time',
    'Cold block length in days',
    'Cold trigger temperature, typed',
  ]) {
    if (!html.includes(`aria-label="${name}"`)) return `no box named "${name}"`;
  }
  return null;
});

check('The sentence carries the chosen currency symbol', () => {
  const inr = CURRENCIES.find(c => c.code === 'INR')!;
  const html = renderToStaticMarkup(
    React.createElement(ProductSection, {
      a: DEFAULTS,
      onChange: () => {},
      onReset: () => {},
      isDefault: true,
      peril: 'heat',
      onPerilChange: () => {},
      currency: inr,
      onCurrencyChange: () => {},
      localHeatTrigger: 25,
      onUseLocalHeatTrigger: () => {},
    })
  );
  return plain(html).includes('Pay ₹') ? null : 'currency symbol not carried into the sentence';
});

check('The note explains what the sentence cannot, that part blocks are lost', () => {
  const text = plain(product('both'));
  if (!text.includes('Only whole blocks pay')) return 'note missing';
  if (!text.includes('do not carry over')) return 'note does not mention the lost remainder';
  return null;
});

const productWith = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(
    React.createElement(ProductSection, {
      a: DEFAULTS,
      onChange: () => {},
      onReset: () => {},
      isDefault: true,
      peril: 'both',
      onPerilChange: () => {},
      currency: GBP,
      onCurrencyChange: () => {},
      localHeatTrigger: 25,
      onUseLocalHeatTrigger: () => {},
      ...extra,
    } as never)
  );

check('Reset stays in place whatever the inputs say', () => {
  // It used to render only when something differed from the defaults, so typing
  // a value back to its starting figure made the button vanish and the panel
  // jump. Present and disabled is steadier and says the same thing.
  const atDefaults = productWith({ isDefault: true });
  const changed = productWith({ isDefault: false });
  if (!atDefaults.includes('Reset')) return 'Reset missing at defaults';
  if (!changed.includes('Reset')) return 'Reset missing after a change';
  if (!/<button[^>]*disabled[^>]*>\s*Reset/.test(atDefaults)) return 'Reset is active with nothing to reset';
  if (/<button[^>]*disabled[^>]*>\s*Reset/.test(changed)) return 'Reset is disabled after a change';
  return null;
});

check('Both triggers still name their source somewhere in the panel', () => {
  // The per-slider notes were removed as clutter. The panel's own note below
  // the two blocks is what now carries the provenance, and it has to keep it.
  const text = plain(productWith({}));
  if (!text.includes('Cold Weather Payment')) return 'the cold source is not named anywhere in the panel';
  return null;
});

check('Trigger limits sit outside the recorded extremes on Earth', () => {
  // 56.7C Furnace Creek 1913 and -89.2C Vostok 1983.
  if (MAX_HEAT_C < 56.7) return `heat cap ${MAX_HEAT_C} excludes the hottest reading on record`;
  if (MIN_COLD_C > -89.2) return `cold cap ${MIN_COLD_C} excludes the coldest reading on record`;
  return null;
});

check('The annual limit and the currency survive the loss of their own panel', () => {
  // Both used to sit in a Limits panel of their own, which cost a panel head,
  // a border and a row of padding to carry two controls. They now close the
  // terms sentence instead. Losing the panel must not lose the controls.
  const html = productWith({});
  if (!html.includes('aria-label="Most payouts in one year"')) return 'the annual limit box is gone';
  if (!html.includes('aria-label="Currency"')) return 'the currency control is gone';
  for (const c of CURRENCIES) {
    if (!html.includes(`value="${c.code}"`)) return `${c.code} is no longer offered`;
  }
  return null;
});

check('The annual limit reads as part of the terms, not as a stray number', () => {
  const text = plain(productWith({}));
  return inOrder(text.toLowerCase(), ['cap payouts at', 'a year per customer', 'show money in']);
});

check('A range input is told to fill its row', () => {
  // flex: 1 does nothing outside a flex container, so without an explicit
  // width the track fell back to the browser's own ~129px inside a 291px row.
  // The labels under it then pointed at nothing, and a value at the maximum
  // parked the thumb mid-row, which is a counting bug dressed as a cosmetic
  // one. Read from the stylesheet so the rule cannot be dropped silently.
  const css = readCss();
  const block = css.match(/input\[type='range'\]\s*\{[^}]*\}/);
  if (!block) return 'no rule for range inputs at all';
  if (!/width:\s*100%/.test(block[0])) return 'range inputs have no explicit width';
  return null;
});

check('No readout cell can be squeezed under the figure it holds', () => {
  // A fixed 128px floor was narrower than an eight digit population, so once a
  // city passed ten million the number ran past its own padding and into the
  // cell border. The floor has to follow the contents instead.
  const css = readCss();
  const cell = css.match(/\.readout > \*\s*\{[^}]*\}/);
  if (!cell) return 'no rule for readout cells at all';
  if (!/min-width:\s*min-content/.test(cell[0])) return 'readout cells have a floor that ignores their contents';
  return null;
});

check('A figure keeps a gutter after its last digit', () => {
  // The floor is the figure plus this gutter, so the longest number in a row
  // is held off the border rather than ending flush against it.
  const css = readCss();
  const value = css.match(/\.readout-value\s*\{[^}]*\}/);
  if (!value) return 'no rule for readout values at all';
  const px = value[0].match(/padding-right:\s*(\d+(?:\.\d+)?)px/);
  if (!px) return 'no gutter after the figure';
  if (parseFloat(px[1]) < 8) return `gutter of ${px[1]}px is too small to read as space`;
  return null;
});

check('A long label does not claim width the figures need', () => {
  // Labels wrap to two lines by design, so their single line width says
  // nothing about how wide a cell should be. Without containment the widest
  // label, not the widest figure, would set the share of the row.
  const css = readCss();
  const label = css.match(/\.readout-label\s*\{[^}]*\}/);
  if (!label) return 'no rule for readout labels at all';
  if (!/contain:\s*inline-size/.test(label[0])) return 'labels still size their own cells';
  return null;
});

/**
 * A small synthetic record so the strip can be rendered against a real
 * analysis rather than a hand-built object that could drift from the model.
 */
const synthetic = (hotDays: boolean) => {
  const dates: string[] = [];
  const tmax: number[] = [];
  const tmean: number[] = [];
  for (let y = 2000; y <= 2024; y++) {
    for (let d = 1; d <= 365; d++) {
      const mm = String(Math.min(12, Math.ceil(d / 30.5))).padStart(2, '0');
      const dd = String(((d - 1) % 28) + 1).padStart(2, '0');
      dates.push(`${y}-${mm}-${dd}`);
      // A fortnight of heat every July, nothing otherwise.
      const hot = hotDays && d >= 190 && d < 204;
      tmax.push(hot ? 31 : 14);
      tmean.push(hot ? 24 : 9);
    }
  }
  return { dates, tmax, tmean };
};

const FIXTURE = analyse(synthetic(true), DEFAULTS, 2000, 2024, 10000);
const UNPRICEABLE = analyse(synthetic(false), DEFAULTS, 2000, 2024, 10000);

// ---------------------------------------------------------------------------
// Pinned results strip
//
// The headline figures have to be legible before anything is read and have to
// survive every state the data can be in, because the strip is on screen even
// when the panel that produced a figure is not.
// ---------------------------------------------------------------------------

const strip = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(ResultStrip, props as never));

const STRIP = {
  result: FIXTURE,
  peril: 'both' as const,
  a: DEFAULTS,
  currency: GBP,
  policies: 89000,
  locationName: 'Greater London',
  loading: false,
};

check('The per-policy figure is named as a premium', () => {
  // "Price" is what the panel does; "premium" is what the figure is. Using the
  // trade's word for the per-policy number is what stops it reading as a fee.
  const text = plain(strip(STRIP)).toLowerCase();
  if (!text.includes('premium a year')) return 'the per-policy figure is not called a premium';
  return null;
});

check('The strip separates one policy from the whole book', () => {
  // Four bare figures with a per-policy price beside a book-wide reserve is
  // actively misleading, so each group has to say which scale it is on.
  const text = plain(strip(STRIP)).toLowerCase();
  return inOrder(text, ['one policy', 'the whole book', 'customers', 'premium', 'reserve']);
});

check('The strip names the area and the take-up its book figures assume', () => {
  const text = plain(strip(STRIP)).toLowerCase();
  if (!text.includes('greater london')) return 'area not named';
  if (!text.includes('take-up')) return 'take-up rate not named';
  if (!text.includes('1.0%')) return 'take-up rate not shown';
  return null;
});

check('The strip counts the book it was given', () => {
  const text = plain(strip(STRIP));
  return text.includes('89,000') ? null : `customer count missing from ${text}`;
});

check('The strip says what it is waiting for rather than showing a blank', () => {
  const waiting = plain(strip({ ...STRIP, result: null, policies: null, loading: true }));
  if (!waiting.includes('Reading the temperature record')) return `loading state reads "${waiting}"`;
  const idle = plain(strip({ ...STRIP, result: null, policies: null, loading: false }));
  // The idle line doubles as the instruction, since the map is the only way on.
  if (!idle.toLowerCase().includes('draw a box')) return `idle state reads "${idle}"`;
  return null;
});

check('The strip never prints a figure it does not have', () => {
  const html = plain(strip({ ...STRIP, result: UNPRICEABLE }));
  if (html.includes('£0')) return 'printed a zero premium';
  if (!html.includes('never fired')) return `unpriceable state reads "${html}"`;
  return null;
});

check('The strip holds back book figures until a population is known', () => {
  const html = plain(strip({ ...STRIP, policies: null }));
  if (html.includes('£0')) return 'printed zero book figures';
  if (!html.toLowerCase().includes('population')) return `no-population state reads "${html}"`;
  return null;
});

check('The strip follows the peril being priced', () => {
  const both = plain(strip(STRIP)).toLowerCase();
  const heat = plain(strip({ ...STRIP, peril: 'heat' })).toLowerCase();
  if (!both.includes('heat and cold')) return 'combined cover not named';
  if (!heat.includes('heat only')) return 'heat-only cover not named';
  return null;
});

// ---------------------------------------------------------------------------
// The guide
//
// It is the first thing anyone sees and the only thing a recruiter may read,
// so its five pages and the claims they make about the console have to stay in
// step with the console itself.
// ---------------------------------------------------------------------------

const guide = renderToStaticMarkup(React.createElement(Tour, { open: true, onClose: () => {} }));
const guideText = plain(guide);

check('The guide opens with five pages', () => {
  const pages = (guide.match(/class="guide-slide"/g) || []).length;
  if (pages !== 5) return `rendered ${pages} pages`;
  if (!guideText.includes('01 / 05')) return 'page counter missing';
  return null;
});

check('The guide runs cover, opportunity, need, offering with navigation, start', () =>
  inOrder(guideText, [
    'Heatwave and cold wave insurance',
    'The opportunity',
    'The need',
    'The offering',
    'How to navigate it',
    'See it price a city',
  ]));

check('The need is argued with named cases, not in the abstract', () => {
  // A business case made of adjectives persuades nobody. Each case has to name
  // who loses money and why the loss is invisible to conventional cover.
  for (const who of [
    'The outdoor worker',
    'The household in a cold snap',
    'The small employer',
    'The city and the large employer',
  ]) {
    if (!guideText.includes(who)) return `no case for ${who.toLowerCase()}`;
  }
  if (!/nothing to claim/i.test(guideText)) return 'does not say why conventional cover misses it';
  return null;
});

check('The cases that cite a precedent cite a real one', () => {
  // Both of these are checkable, and the second is the trigger this tool uses,
  // so if the cold trigger ever moves off the Cold Weather Payment rule the
  // card becomes a false claim.
  if (!guideText.includes('Swiss Re')) return 'the heat precedent lost its underwriter';
  if (!/50,000 informal women workers/.test(guideText)) return 'the heat precedent lost its scale';
  if (!guideText.includes('Cold Weather Payment')) return 'the cold precedent is gone';
  if (!/£25 for every 7 consecutive days at or below 0°C/.test(guideText)) {
    return 'the Cold Weather Payment terms no longer match the scheme';
  }
  return null;
});

check('The guide closes rather than linking away', () => {
  // The standalone deck pointed at a public URL. Inside the tool that button
  // has to dismiss the guide, not navigate.
  if (/href="https?:/.test(guide)) return 'the guide still carries an external link';
  if (!guideText.includes('Open BellWeather')) return 'no way out of the last page';
  return null;
});

check('The guide lists the panels in the order the console uses', () =>
  inOrder(guideText, ['01 Product', '02 Price', '03 Portfolio', '04 Hazard', '05 Sensitivity', '06 Outlook']));

check('The drawing of the console matches the console', () => {
  // The mock claims a pinned bar with two scales on it. If the real strip ever
  // stops carrying both, the drawing is a lie.
  if (!guideText.includes('One policy')) return 'mock strip lost the per-policy figure';
  if (!guideText.includes('The whole book')) return 'mock strip lost the book figures';
  if (!guideText.includes('Pricing this area')) return 'mock map lost its caption';
  return null;
});

check('The guide calls model output a projection, not a forecast or a test', () => {
  // 2031 to 2050 is scenario-conditional model output. Calling it a forecast,
  // or claiming the product was tested, overstates what the panel can show.
  if (/tested against/i.test(guideText)) return 'still claims the product was tested';
  if (/forecast/i.test(guideText)) return 'calls a multi-decadal projection a forecast';
  if (!guideText.includes('Projected to 2050')) return 'projection wording missing';
  return null;
});

check('The guide does not overstate how this work is normally done', () => {
  if (guideText.includes('paid data')) return 'still claims the work needs paid data';
  if (!guideText.includes('licensed weather index')) return 'settlement caveat missing';
  return null;
});

check('The guide credits its author and says how to reopen it', () => {
  if (!guideText.includes('Kshitij Divansh Saxena')) return 'author missing';
  if (!guideText.toLowerCase().includes('top right')) return 'does not say where to find it again';
  return null;
});

check('The guide is a card on a scrim, not a full screen takeover', () => {
  // The console has to stay visible behind it, which is what lets a visitor
  // see the thing the guide is describing while they read about it.
  if (!guide.includes('class="guide-panel"')) return 'no card inside the scrim';
  const panels = (guide.match(/class="guide-panel"/g) || []).length;
  if (panels !== 1) return `${panels} cards rendered`;
  return null;
});

check('The guide keeps its controls inside the card', () => {
  // Floating the arrows at the window edges would put them over the console,
  // which is the part the card exists to leave visible.
  if (!guide.includes('class="guide-foot"')) return 'no footer row';
  const foot = guide.slice(guide.indexOf('class="guide-foot"'));
  for (const want of ['Previous page', 'Next page', 'Page 1:']) {
    if (!foot.includes(want)) return `${want} is not in the footer`;
  }
  return null;
});

check('The guide renders nothing when closed', () => {
  const shut = renderToStaticMarkup(React.createElement(Tour, { open: false, onClose: () => {} }));
  return shut === '' ? null : 'rendered while closed';
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
