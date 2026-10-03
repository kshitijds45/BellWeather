/**
 * Data layer
 *
 * Three free, keyless sources:
 *
 *   Open-Meteo Historical Weather API   daily temperature 1991 onwards
 *   Open-Meteo Climate API              CMIP6 daily temperature to 2050
 *   WorldPop stats API                  population inside a drawn polygon
 *
 * Every request URL is logged to the browser console so any figure on screen
 * can be checked against the raw source.
 */

const ARCHIVE_API = 'https://archive-api.open-meteo.com/v1/archive';
const CLIMATE_API = 'https://climate-api.open-meteo.com/v1/climate';
const WORLDPOP_API = 'https://api.worldpop.org/v1';

/**
 * Gaps between checks on a queued WorldPop task, in milliseconds.
 *
 * Half a second for the first five seconds, where most tasks finish, then one
 * second so a slow one does not turn into fifty requests. Modelled against the
 * flat two second wait this replaces: never slower at any task length, and up
 * to a second and a half faster on the short ones that were paying two seconds
 * to learn they had already finished.
 */
const POLL_STEPS = [...Array(10).fill(500), 1000];

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const centreOf = (b: Bounds) => ({
  lat: (b.north + b.south) / 2,
  lon: (b.east + b.west) / 2,
});

/** A daily series. Values may be null where the source has a gap. */
export interface DailySeries {
  dates: string[];
  tmax: Array<number | null>;
  tmean: Array<number | null>;
}

const sleepMs = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Population answers, keyed on the rounded box.
 *
 * WorldPop sums a 100 m raster over the polygon, which is real work on a free
 * service, so the same area should never be asked for twice. Panning back to
 * somewhere already priced is then instant rather than another wait.
 */
const populationCache = new Map<string, number>();

async function getJson(url: string, signal?: AbortSignal, attempt = 0): Promise<any> {
  const response = await fetch(url, { signal });

  // Open-Meteo enforces a minutely allowance. Back off and retry rather than
  // surfacing a rate limit to the user as a data failure.
  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 6000 * (attempt + 1);
    await sleepMs(wait);
    return getJson(url, signal, attempt + 1);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.reason ? `: ${body.reason}` : '';
    } catch {
      /* not JSON */
    }
    throw new Error(`HTTP ${response.status}${detail}`);
  }
  const data = await response.json();
  if (data?.error === true) throw new Error(data.reason ?? data.error_message ?? 'Request failed');
  return data;
}

// ---------------------------------------------------------------------------
// Historical record
// ---------------------------------------------------------------------------

// 1991 aligns with the 1991-2020 climate normal the Met Office uses for its
// current heatwave thresholds. The record ends at the last complete calendar
// year, because the archive lags real time by several days.
export const HISTORY_START = 1991;
export const historyEnd = () => new Date().getUTCFullYear() - 1;

export const fetchHistory = async (
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<DailySeries> => {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: `${HISTORY_START}-01-01`,
    end_date: `${historyEnd()}-12-31`,
    daily: 'temperature_2m_max,temperature_2m_mean',
    timezone: 'auto',
    // Pinned deliberately. Left to itself the archive serves "best match",
    // which stitches IFS HRES, ERA5 and ERA5-Land together across the record.
    // That is fine for looking up a day and wrong for fitting a thirty five
    // year warming trend, because part of the measured trend would be the
    // underlying dataset changing rather than the climate. ERA5 alone is
    // homogeneous from 1940 and covers sea as well as land, which the coarser
    // grid is the price of.
    models: 'era5',
  });
  const url = `${ARCHIVE_API}?${params}`;
  console.info('Historical record request:', url);

  const data = await getJson(url, signal);
  const d = data?.daily;
  if (!d?.time?.length) throw new Error('The historical archive returned no data for this location');

  return {
    dates: d.time,
    tmax: d.temperature_2m_max,
    tmean: d.temperature_2m_mean,
  };
};

// ---------------------------------------------------------------------------
// Climate projection
// ---------------------------------------------------------------------------

// Two HighResMIP models, both carrying the full daily variable set. The API
// charges by range, models and variables, so this stays deliberately narrow.
export const CLIMATE_MODELS = ['MRI_AGCM3_2_S', 'EC_Earth3P_HR'];
export const BASELINE = { start: 2000, end: 2019 };
export const FUTURE = { start: 2031, end: 2050 };

/** One daily series per model. */
export type ModelSeries = Record<string, DailySeries>;

export const fetchProjection = async (
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ModelSeries> => {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: `${BASELINE.start}-01-01`,
    end_date: `${FUTURE.end}-12-31`,
    models: CLIMATE_MODELS.join(','),
    daily: 'temperature_2m_max,temperature_2m_mean',
  });
  const url = `${CLIMATE_API}?${params}`;
  console.info('Climate projection request:', url);

  const data = await getJson(url, signal);
  const d = data?.daily;
  if (!d?.time?.length) throw new Error('The climate API returned no projection for this location');

  // With several models each variable arrives once per model, suffixed with
  // the model name. With a single model the suffix is omitted.
  const out: ModelSeries = {};
  CLIMATE_MODELS.forEach(model => {
    const tmax = d[`temperature_2m_max_${model}`] ?? (CLIMATE_MODELS.length === 1 ? d.temperature_2m_max : null);
    const tmean = d[`temperature_2m_mean_${model}`] ?? (CLIMATE_MODELS.length === 1 ? d.temperature_2m_mean : null);
    if (Array.isArray(tmax) && Array.isArray(tmean)) {
      out[model] = { dates: d.time, tmax, tmean };
    }
  });

  if (Object.keys(out).length === 0) throw new Error('The climate API response had no usable model series');
  return out;
};

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

// WorldPop's global dataset runs to 2020, which is its most recent year.
export const POPULATION_YEAR = 2020;

export const fetchPopulation = async (bounds: Bounds, signal?: AbortSignal): Promise<number> => {
  const { north: n, south: s, east: e, west: w } = bounds;
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    ],
  };

  const key = [w, s, e, n].map(v => v.toFixed(3)).join(',');
  const cached = populationCache.get(key);
  if (cached !== undefined) return cached;

  const url =
    `${WORLDPOP_API}/services/stats?dataset=wpgppop&year=${POPULATION_YEAR}` +
    `&geojson=${encodeURIComponent(JSON.stringify(geojson))}&runasync=false`;
  console.info('Population request:', url);

  let result = await getJson(url, signal);

  // A synchronous request that runs past the server's limit comes back as a
  // queued task instead, which has to be polled for its result.
  //
  // The gap between checks starts short and lengthens. A flat two second wait
  // charged every caller two seconds even when the task had finished in two
  // hundred milliseconds, which was most of the delay people noticed.
  const deadline = Date.now() + 60_000;
  let poll = 0;
  while (result?.status !== 'finished' && result?.taskid && Date.now() < deadline) {
    await sleepMs(POLL_STEPS[Math.min(poll, POLL_STEPS.length - 1)]);
    poll += 1;
    result = await getJson(`${WORLDPOP_API}/tasks/${result.taskid}`, signal);
  }

  const total = Number(result?.data?.total_population);
  if (!isFinite(total) || total < 0) throw new Error('WorldPop returned no population figure');
  const rounded = Math.round(total);
  populationCache.set(key, rounded);
  return rounded;
};
