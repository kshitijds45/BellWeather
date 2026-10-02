import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { TOOL_NAME, CREATOR } from '../branding';
import '../../styles/guide.css';

const STORAGE_KEY = 'bellweather-tour-seen-v1';

const PAGES = ['Cover', 'The opportunity', 'The offering', 'How to navigate it', 'Start'];

/** The bell curve, drawn at whatever size the caller needs. */
const Mark: React.FC<{ className?: string; width?: number; height?: number; stroke?: number }> = ({
  className,
  width,
  height,
  stroke = 26,
}) => (
  <svg
    className={className}
    width={width}
    height={height}
    viewBox="-22 -22 530 412"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M3.5 364.505C180.501 356.505 139 2.00481 247.5 3.50481"
      stroke="var(--g-cold)"
      strokeWidth={stroke}
      strokeLinecap="round"
    />
    <path
      d="M247.5 3.50482C356 5.00482 305.001 336.005 482 364.505"
      stroke="var(--g-heat)"
      strokeWidth={stroke}
      strokeLinecap="round"
    />
  </svg>
);

const TABS: Array<[string, string]> = [
  ['01 Product', 'Set the terms of the policy'],
  ['02 Price', 'What to charge and why'],
  ['03 Portfolio', 'The policy sold across a city'],
  ['04 Hazard', 'How often it would have paid out'],
  ['05 Sensitivity', 'What the price is most exposed to'],
  ['06 Outlook', 'The same policy priced to 2050'],
];

/**
 * A scale drawing of the console, so the three numbered moves point at
 * something the reader recognises the moment the guide closes. It mirrors the
 * real layout: half map, half analysis, tabs then the pinned results.
 */
const Mock: React.FC = () => (
  <div className="guide-mock-wrap" aria-hidden="true">
    <div className="guide-mock">
      <div className="guide-mock-top">
        <Mark width={15} height={11} stroke={44} />
        {TOOL_NAME}
        <div className="guide-pill">
          <span>Analysis</span>
          <span>Method</span>
        </div>
      </div>
      <div className="guide-mock-body">
        <div className="guide-mock-map">
          <div className="guide-search">Search any city</div>
          <div className="guide-area" />
          <div className="guide-caption">Pricing this area</div>
        </div>
        <div className="guide-mock-pane">
          <div className="guide-mock-tabs">
            {TABS.map(([name], i) => (
              <span key={name} data-on={i === 0 ? '' : undefined}>
                {name}
              </span>
            ))}
          </div>
          <div className="guide-mock-strip">
            <div>
              <i>One policy</i>
              <b>£ ··</b>
            </div>
            <div>
              <i>The whole book</i>
              <span className="guide-book">
                <span>·· customers</span>
                <span>£·· premium</span>
              </span>
            </div>
          </div>
          <div className="guide-mock-panels">
            <div className="guide-p" />
            <div className="guide-p">
              <div className="guide-bars">
                {[30, 55, 20, 75, 40, 95, 60].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="guide-p" />
          </div>
        </div>
      </div>
    </div>
    <span className="guide-tag" data-t="1">1</span>
    <span className="guide-tag" data-t="2">2</span>
    <span className="guide-tag" data-t="3">3</span>
  </div>
);

/** How long the card takes to dissolve into the console. Matches guide.css. */
const EXIT_MS = 340;

export const Tour: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [page, setPage] = useState(0);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setPage(0);
      setClosing(false);
    }
  }, [open]);

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
  }, []);

  /**
   * Closing is animated rather than instant. Cutting straight from a full card
   * to the console is jarring, and the card scaling forward as it fades reads
   * as the guide opening into the tool rather than simply disappearing.
   */
  const dismiss = React.useCallback(() => {
    if (closing) return;
    const instant =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant) return onClose();
    setClosing(true);
    exitTimer.current = window.setTimeout(onClose, EXIT_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open) return;
    const go = (n: number) => setPage(p => Math.max(0, Math.min(PAGES.length - 1, p + n)));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dismiss();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      if (e.key === 'Home') setPage(0);
      if (e.key === 'End') setPage(PAGES.length - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  // Each page starts at its own top, so a long page does not hand the next one
  // a scrolled viewport.
  useEffect(() => {
    panelRef.current?.querySelectorAll('.guide-slide').forEach(el => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [page]);

  if (!open) return null;

  const last = page === PAGES.length - 1;

  const slide = (i: number, label: string, children: React.ReactNode, innerClass?: string) => (
    <section
      className="guide-slide"
      data-state={i === page ? 'active' : i < page ? 'before' : 'after'}
      aria-hidden={i === page ? 'false' : 'true'}
      aria-label={label}
    >
      <div className={innerClass ? `guide-inner ${innerClass}` : 'guide-inner'}>{children}</div>
    </section>
  );

  return (
    <div
      className="guide"
      role="dialog"
      aria-modal="true"
      aria-label={`${TOOL_NAME} guide`}
      ref={panelRef}
      data-closing={closing ? '' : undefined}
      onMouseDown={e => {
        // Clicking the console behind the card dismisses it, which is what the
        // visible background invites. The help button brings it back.
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="guide-panel">
        <header className="guide-topbar">
          <button className="guide-wordmark" onClick={() => setPage(0)} aria-label="Back to the first page">
            <Mark width={26} height={20} stroke={40} />
            {TOOL_NAME}
          </button>
          <div className="guide-topbar-right">
            <div className="guide-counter" aria-live="polite">
              <b>{String(page + 1).padStart(2, '0')}</b> / {String(PAGES.length).padStart(2, '0')}
            </div>
            <button className="guide-close" onClick={dismiss}>
              <X className="size-3.5" />
              Skip to the tool
            </button>
          </div>
        </header>

        <main className="guide-deck">
          {slide(
            0,
            'BellWeather',
            <>
              <Mark className="guide-mark" />
              <h1>{TOOL_NAME}</h1>
              <p className="guide-tagline">
                Heatwave and cold wave insurance, priced from open climate data.
              </p>
              <p className="guide-hint">A two minute guide · Use the arrows to continue</p>
            </>,
            'guide-cover'
          )}

          {slide(
            1,
            'The opportunity',
            <>
              <p className="guide-eyebrow">The opportunity</p>
              <h2>Extreme temperatures are a growing risk that is hard to insure.</h2>
              <p className="guide-lede">
                Heat and cold rarely damage property in a way an adjuster can measure. They cost
                people in lost work, health and energy bills. Traditional insurance struggles to
                price that. Parametric insurance does not.
              </p>
              <div className="guide-split">
                <article className="guide-card" style={{ ['--g-accent' as string]: 'var(--g-cold)' }}>
                  <div className="guide-label">Why parametric</div>
                  <h3>It pays on the weather, not on a claim.</h3>
                  <p>
                    The policy pays a fixed sum when temperature crosses an agreed line. There is no
                    claim form and no loss adjuster. That leaves one pricing question: how often does
                    the line get crossed?
                  </p>
                </article>
                <article className="guide-card" style={{ ['--g-accent' as string]: 'var(--g-heat)' }}>
                  <div className="guide-label">Why this tool</div>
                  <h3>It answers that question for any place, in minutes.</h3>
                  <p>
                    Pricing this cover is specialist work, and a live contract settles on a licensed
                    weather index. BellWeather does the analysis from free public data, in the
                    browser, with every step open to inspection.
                  </p>
                </article>
              </div>
            </>
          )}

          {slide(
            2,
            'The offering',
            <>
              <p className="guide-eyebrow">The offering</p>
              <h2>Pick an area on the map. Get a price you can defend.</h2>
              <div className="guide-grid4">
                {[
                  ['01', 'Built on evidence', 'Daily temperatures since 1991, adjusted for the warming trend so every past year counts as today\u2019s climate.', 'var(--g-cold)'],
                  ['02', 'Priced like an insurer', 'A premium set to a target profit margin, with the 1-in-200 year payout insurers must hold reserves against.', 'var(--g-ink)'],
                  ['03', 'From one policy to a city', 'Population data turns a single price into a full book: premiums taken in, payouts and reserves needed.', 'var(--g-ink)'],
                  ['04', 'Projected to 2050', 'Climate model projections show whether the product still works, and what it costs, in a warmer world.', 'var(--g-heat)'],
                ].map(([num, title, body, accent]) => (
                  <article key={num} className="guide-card" style={{ ['--g-accent' as string]: accent }}>
                    <div className="guide-num">{num}</div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
              <div className="guide-footnote">
                <span>Every assumption editable</span>
                <span>Every figure recalculates instantly</span>
                <span>Every source and formula under Method</span>
              </div>
            </>
          )}

          {slide(
            3,
            'How to navigate it',
            <>
              <p className="guide-eyebrow">How to navigate it</p>
              <h2>Three moves to a price.</h2>
              <div className="guide-nav-layout">
                <Mock />
                <div>
                  <ol className="guide-steps">
                    <li>
                      <span className="guide-n">1</span>
                      <div>
                        <h3>Choose an area</h3>
                        <p>Search a city or draw a box on the map. It opens on Greater London.</p>
                      </div>
                    </li>
                    <li>
                      <span className="guide-n">2</span>
                      <div>
                        <h3>Read the headline bar</h3>
                        <p>
                          The price for one policy and the figures for the whole book stay pinned at
                          the top wherever you scroll.
                        </p>
                      </div>
                    </li>
                    <li>
                      <span className="guide-n">3</span>
                      <div>
                        <h3>Work through the tabs</h3>
                        <dl className="guide-tabs-list">
                          {TABS.map(([name, what]) => (
                            <React.Fragment key={name}>
                              <dt>{name}</dt>
                              <dd>{what}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </>
          )}

          {slide(
            4,
            'Start',
            <>
              <p className="guide-eyebrow">Try it</p>
              <h2>See it price a city.</h2>
              <p className="guide-lede">Pick a place you know and watch the price build.</p>
              <button className="guide-cta" onClick={dismiss}>
                Open {TOOL_NAME}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <div className="guide-notes">
                <span>Best on a laptop or desktop</span>
                <span>Free and no sign up</span>
                <span>This guide is always under the ? in the top right</span>
              </div>
              <p className="guide-sign">
                Built by <strong>{CREATOR}</strong>
              </p>
            </>,
            'guide-launch'
          )}
        </main>

        <footer className="guide-foot">
          <nav className="guide-progress" aria-label="Pages">
            {PAGES.map((name, i) => (
              <button
                key={name}
                onClick={() => setPage(i)}
                aria-current={i === page ? 'true' : 'false'}
                aria-label={`Page ${i + 1}: ${name}`}
              />
            ))}
          </nav>
          <div className="guide-arrows">
            <button
              className="guide-arrow"
              data-dir="prev"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              className="guide-arrow"
              data-dir="next"
              onClick={() => (last ? dismiss() : setPage(p => p + 1))}
              disabled={last}
              aria-label="Next page"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Shown on every load by design: this is a specialist tool and most visitors
// arrive without context, so the orientation is worth repeating. The help
// button in the top bar opens the same guide at any time.
export const hasSeenTour = (): boolean => false;

export const markTourSeen = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private browsing: the guide shows again next visit */
  }
};
