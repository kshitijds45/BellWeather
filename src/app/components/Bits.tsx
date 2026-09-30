import React from 'react';

export const SectionHead: React.FC<{
  index: string;
  title: string;
  standfirst?: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ index, title, standfirst, aside }) => (
  <header className="flex items-start justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <p className="section-index">{index}</p>
      <h2 className="section-title">{title}</h2>
      {standfirst && <p className="section-standfirst">{standfirst}</p>}
    </div>
    {aside && <div className="shrink-0">{aside}</div>}
  </header>
);

/** A compact readout. Values are sized to be scanned, not admired. */
export const Readout: React.FC<{
  items: Array<{ label: string; value: string; note?: string; accent?: string }>;
}> = ({ items }) => (
  <div className="readout">
    {items.map(i => (
      <div key={i.label}>
        <p className="readout-label" title={i.label}>{i.label}</p>
        <p className="readout-value" style={i.accent ? { color: i.accent } : undefined}>
          {i.value}
        </p>
        {i.note && <p className="readout-note">{i.note}</p>}
      </div>
    ))}
  </div>
);

/** Fields share a two-line label box so their inputs line up in a grid. */
export const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  prefix?: string;
}> = ({ label, value, onChange, step = 1, min, max, suffix, prefix }) => (
  <label className="block">
    <span className="field-label">{label}</span>
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{prefix}</span>}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {suffix && <span className="text-xs shrink-0 whitespace-nowrap" style={{ color: 'var(--muted)' }}>{suffix}</span>}
    </div>
  </label>
);

/**
 * A slider with its value shown as a readout, which is the control an
 * underwriter reaches for when feeling out a threshold rather than
 * committing to one.
 */
export const SliderField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}> = ({ label, value, onChange, min, max, step = 1, unit, hint }) => {
  // Sliders are for feeling out a range, typing is for committing to a figure.
  // Both edit the same value, and the typed box is not clamped to the slider's
  // range, so a threshold outside the comfortable range is still reachable.
  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) onChange(v);
  };

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={e => onChange(parseFloat(e.target.value))}
          aria-label={label}
        />
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          onChange={e => commit(e.target.value)}
          aria-label={`${label}, typed`}
        />
        {unit && <span style={{ fontSize: 11, color: 'var(--muted)', width: 26 }}>{unit}</span>}
      </div>
      {hint && <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
};

export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
  peril,
}: {
  options: Array<[T, string]>;
  value: T;
  onChange: (v: T) => void;
  label?: string;
  peril?: boolean;
}) {
  return (
    <div>
      {label && <span className="field-label">{label}</span>}
      <div className="pill-select">
        {options.map(([key, text]) => (
          <button
            key={key}
            className="pill"
            data-active={value === key}
            data-peril={peril ? key : undefined}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--muted)' }}>
    {children}
  </p>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="panel panel-pad">
    <p className="text-xs" style={{ color: 'var(--muted)' }}>{children}</p>
  </div>
);

export const PanelBlock: React.FC<{ head: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  head,
  children,
  aside,
}) => (
  <div className="panel">
    <div className="panel-head flex items-center justify-between gap-3">
      <span>{head}</span>
      {aside}
    </div>
    <div className="p-3.5">{children}</div>
  </div>
);

/**
 * One temperature scale carrying both triggers.
 *
 * Cold sits left of zero, heat sits right of it, and neither can cross. Two
 * separate range inputs share a continuous track, each sized to its share of
 * the overall scale, which keeps them genuinely on one ruler while staying
 * keyboard accessible. Zero is the hard divider between the two perils.
 */
export const TemperatureScale: React.FC<{
  coldValue: number;
  hotValue: number;
  onColdChange: (v: number) => void;
  onHotChange: (v: number) => void;
  coldMin?: number;
  hotMax?: number;
  showCold?: boolean;
  showHeat?: boolean;
}> = ({
  coldValue,
  hotValue,
  onColdChange,
  onHotChange,
  coldMin = -20,
  hotMax = 45,
  showCold = true,
  showHeat = true,
}) => {
  const span = Math.abs(coldMin) + hotMax;
  const coldShare = (Math.abs(coldMin) / span) * 100;

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        {showCold ? (
          <span className="text-xs" style={{ color: 'var(--cold)', fontWeight: 600 }}>
            Cold {coldValue}°C
          </span>
        ) : <span />}
        {showHeat ? (
          <span className="text-xs" style={{ color: 'var(--heat)', fontWeight: 600 }}>
            Heat {hotValue}°C
          </span>
        ) : <span />}
      </div>

      <div className="flex items-center" style={{ gap: 0 }}>
        <div style={{ width: `${coldShare}%`, opacity: showCold ? 1 : 0.25 }}>
          <input
            type="range"
            className="range-cold"
            min={coldMin}
            max={0}
            step={0.5}
            value={Math.min(0, coldValue)}
            disabled={!showCold}
            onChange={e => onColdChange(parseFloat(e.target.value))}
            aria-label="Cold trigger temperature"
          />
        </div>

        <span
          aria-hidden
          style={{ width: 1, height: 16, background: 'var(--rule-strong)', flexShrink: 0 }}
        />

        <div style={{ width: `${100 - coldShare}%`, opacity: showHeat ? 1 : 0.25 }}>
          <input
            type="range"
            className="range-heat"
            min={0}
            max={hotMax}
            step={0.5}
            value={Math.max(0, hotValue)}
            disabled={!showHeat}
            onChange={e => onHotChange(parseFloat(e.target.value))}
            aria-label="Heat trigger temperature"
          />
        </div>
      </div>

      <div className="flex justify-between mt-1.5" style={{ fontSize: 9.5, color: 'var(--muted)' }}>
        <span>{coldMin}°C</span>
        <span style={{ marginLeft: `calc(${coldShare}% - 50px)` }}>0°C</span>
        <span>{hotMax}°C</span>
      </div>
    </div>
  );
};
