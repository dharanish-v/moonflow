// src/components/Stepper.tsx — shared +/- number control. Used by
// Onboarding (first-run averages) and Settings' edit sheets for the same
// two fields, so the bounds/behavior can't drift between where a value is
// first set and where it's later edited.
import { Button } from './ui/button';

export function Stepper({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const labelId = `${label.replace(/\s+/g, '-').toLowerCase()}-label`;
  return (
    <div className="mb-flow-6">
      <span id={labelId} className="mb-flow-2 block text-flow-caption text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex items-center justify-between rounded-md bg-card px-flow-4 py-flow-3">
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className="rounded-full"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          &minus;
        </Button>
        <span className="text-flow-body text-foreground">
          {value} {unit}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          className="rounded-full"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}
