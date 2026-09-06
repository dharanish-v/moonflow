import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MoodButton } from './MoodButton';

function Icon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

describe('MoodButton', () => {
  it('reflects selected state via aria-pressed', () => {
    render(
      <MoodButton selected aria-label="happy">
        <Icon />
      </MoodButton>,
    );
    expect(screen.getByRole('button', { name: 'happy' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('meets the 44px circular touch target minimum (ADR-024)', () => {
    render(
      <MoodButton aria-label="neutral">
        <Icon />
      </MoodButton>,
    );
    expect(screen.getByRole('button')).toHaveClass('size-11');
  });

  it('has no accessibility violations when given an aria-label', async () => {
    const { container } = render(
      <div role="group" aria-label="Mood">
        <MoodButton aria-label="cry">
          <Icon />
        </MoodButton>
        <MoodButton selected aria-label="happy">
          <Icon />
        </MoodButton>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
