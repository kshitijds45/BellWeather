import React, { useEffect, useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { TOOL_NAME, TOOL_TAGLINE, CREATOR } from '../branding';
import { Logo } from './Logo';

const STORAGE_KEY = 'bellweather-tour-seen-v1';

const STEPS = [
  {
    title: 'What this does',
    body:
      'This works out a fair price for insurance that pays out when the weather gets dangerously hot or cold. The policy pays a fixed amount whenever the temperature crosses an agreed line, so nobody has to prove what they lost and nobody comes to inspect. That makes the price simple to work out: the only thing you need to know is how often that temperature gets crossed, and thirty five years of weather records can tell you.',
  },
  {
    title: 'How to use it',
    body:
      'Pick an area on the map, then work down the panels on the right. Product is where you set the rules: how hot, for how many days, how much it pays. Hazard shows how often that has actually happened. Price turns that into a yearly premium. Portfolio scales it up to a whole city. Sensitivity lets you test how the price moves if you change one setting. Everything updates as you type.',
  },
  {
    title: 'Worth knowing',
    body:
      'The default settings come from real UK rules: the Met Office definition of a heatwave, and the government scheme that pays people during cold snaps. You can change all of them. What this cannot do is promise that a payout matches what someone actually lost, because it only looks at temperature. It is a tool for thinking through a price, not a real quote. The Method tab explains every number and every shortcut taken.',
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
