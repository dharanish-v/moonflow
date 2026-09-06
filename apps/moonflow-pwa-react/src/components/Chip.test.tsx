import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  it('reflects selected state via aria-pressed', () => {
    render(<Chip selected>Cramps</Chip>);
    expect(screen.getByRole('button', { name: 'Cramps' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('meets the 44px minimum touch target height (ADR-024)', () => {
    render(<Chip>Bloating</Chip>);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });

  it('supports multi-select — each chip toggles independently', async () => {
    const onClickA = vi.fn();
    const onClickB = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Chip onClick={onClickA}>Cramps</Chip>
        <Chip onClick={onClickB}>Fatigue</Chip>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Cramps' }));
    expect(onClickA).toHaveBeenCalledOnce();
    expect(onClickB).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <div role="group" aria-label="Symptoms">
        <Chip selected>Cramps</Chip>
        <Chip>Bloating</Chip>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
