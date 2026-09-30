import React, { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { TOOL_NAME, TOOL_TAGLINE, CREATOR } from '../branding';
import { Logo } from './Logo';

const STORAGE_KEY = 'bellweather-tour-seen-v1';

const STEPS = [
  {
    title: 'What this does',
    body:
      'BellWeather prices insurance that pays a fixed sum when temperature crosses an agreed threshold. Settlement follows a published weather index rather than an assessment of loss, which removes claims handling from the product entirely and reduces pricing to a single question: how often that threshold is crossed. Thirty five years of historical weather data answers it for any location on the map.',
  },
  {
    title: 'How to use it',
    body:
      'Select an area, then work down the panels. Product sets the trigger, duration and payout. Hazard shows how often those terms would have paid out since 1991. Price builds the rate, the reserve it requires and the return that reserve earns. Portfolio scales the result to a city. Sensitivity tests any single assumption across a range. Outlook projects the rate forward to 2050 under climate models, which informs whether the product remains viable rather than what to charge today. Every figure recalculates as inputs change.',
  },
  {
    title: 'Scope and limits',
    body:
      'Default triggers follow the Met Office heatwave definition and the UK Cold Weather Payment rule. The reserve standard follows Solvency UK. All are editable. The index cannot reflect an individual policyholder\u2019s actual loss, and no settlement source is named here, so this is an analytical tool rather than a quotation. Method sets out every source, formula and limitation behind the figures.',
  },
];





export const Tour: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const first = step === 0;
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
      style={{ background: 'rgba(12, 14, 16, 0.82)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${TOOL_NAME} walkthrough`}
    >
      <div className="panel w-full max-w-lg relative" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md"
          style={{ color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
          aria-label="Close walkthrough"
        >
          <X className="size-4" />
        </button>
        <div className="p-6">
          {first && (
            <div className="mb-5 pb-4" style={{ borderBottom: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-3">
                <Logo size={34} weight={30} />
                <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1 }}>{TOOL_NAME}</h1>
              </div>
              <p className="text-xs mt-2.5" style={{ color: 'var(--muted)' }}>{TOOL_TAGLINE}</p>
            </div>
          )}
          <h2 className="mb-2.5" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{STEPS[step].title}</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{STEPS[step].body}</p>

          <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Step ${i + 1}`}
                  style={{
                    width: i === step ? 18 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: i === step ? 'var(--signal)' : 'var(--rule-strong)',
                    border: 0,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-ghost" style={{ color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}>
                Skip
              </button>
              {!first && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="btn-ghost inline-flex items-center gap-1"
                  
                >
                  <ArrowLeft className="size-3" /> Back
                </button>
              )}
              <button
                onClick={() => (last ? onClose() : setStep(s => s + 1))}
                className="btn-solid inline-flex items-center gap-1.5"
                
              >
                {last ? 'Start' : 'Next'}
                {!last && <ArrowRight className="size-3" />}
              </button>
            </div>
          </div>
          {first && <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>Built by {CREATOR}</p>}
        </div>
      </div>
    </div>
  );
};

// Shown on every load by design: this is a specialist tool and most visitors
// arrive without context, so the orientation is worth repeating.
export const hasSeenTour = (): boolean => false;

export const markTourSeen = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private browsing: the tour shows again next visit */
  }
};
