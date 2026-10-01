/**
 * Presentation checks.
 *
 * These cover the things that are easy to get wrong in the interface and
 * impossible to see from the model tests: which years get an axis label,
 * whether the confidence band renders as a range rather than a dash, and
 * whether a slider track still reaches a value typed in from outside it.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { yearTicks, OutlookTooltip, MAX_HEAT_C, MIN_COLD_C } from '../src/app/components/Sections';
import { sliderBounds } from '../src/app/components/Bits';
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
// Slider track bounds
// ---------------------------------------------------------------------------

check('An in-range value leaves the track exactly as declared', () =>
  eq(sliderBounds(0, 45, 28), { lo: 0, hi: 45 }, 'bounds'));

check('A heat threshold above the track extends the top end', () => {
  const b = sliderBounds(0, 45, 60);
  if (b.hi < 60) return `track stops at ${b.hi}, below the value`;
  return eq(b, { lo: 0, hi: 60 }, 'bounds');
});

check('A cold threshold below the track extends the bottom end', () => {
  const b = sliderBounds(-20, 0, -35);
  if (b.lo > -35) return `track stops at ${b.lo}, above the value`;
  return eq(b, { lo: -35, hi: 0 }, 'bounds');
});

check('An extended end rounds outward so it never cuts the value off', () => {
  const hot = sliderBounds(0, 45, 52.5);
  if (hot.hi < 52.5) return `top end ${hot.hi} is below 52.5`;
  if (hot.hi !== 53) return `top end is ${hot.hi}, wanted a whole 53`;
  const chilly = sliderBounds(-20, 0, -27.5);
  if (chilly.lo > -27.5) return `bottom end ${chilly.lo} is above -27.5`;
  if (chilly.lo !== -28) return `bottom end is ${chilly.lo}, wanted a whole -28`;
  return null;
});

check('A fractional declared minimum is not rounded away', () => {
  // Adoption runs from 0.05%, which Math.floor would flatten to zero.
  return eq(sliderBounds(0.05, 100, 12), { lo: 0.05, hi: 100 }, 'bounds');
});

check('A value exactly on either end does not move the track', () => {
  if (JSON.stringify(sliderBounds(0, 45, 45)) !== JSON.stringify({ lo: 0, hi: 45 })) return 'top end moved';
  if (JSON.stringify(sliderBounds(0, 45, 0)) !== JSON.stringify({ lo: 0, hi: 45 })) return 'bottom end moved';
  return null;
});

check('A non-finite value falls back to the declared track', () =>
  eq(sliderBounds(0, 45, NaN), { lo: 0, hi: 45 }, 'bounds'));

check('The track always contains the value across the permitted range', () => {
  for (let v = MIN_COLD_C; v <= MAX_HEAT_C; v += 0.5) {
    const heat = sliderBounds(0, 45, Math.max(0, v));
    if (Math.max(0, v) < heat.lo || Math.max(0, v) > heat.hi) return `heat track lost ${v}`;
    const cold = sliderBounds(-20, 0, Math.min(0, v));
    if (Math.min(0, v) < cold.lo || Math.min(0, v) > cold.hi) return `cold track lost ${v}`;
  }
  return null;
});

check('Trigger limits sit outside the recorded extremes on Earth', () => {
  // 56.7C Furnace Creek 1913 and -89.2C Vostok 1983.
  if (MAX_HEAT_C < 56.7) return `heat cap ${MAX_HEAT_C} excludes the hottest reading on record`;
  if (MIN_COLD_C > -89.2) return `cold cap ${MIN_COLD_C} excludes the coldest reading on record`;
  return null;
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
