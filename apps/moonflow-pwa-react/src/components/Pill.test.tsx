import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Pill } from './Pill';

describe('Pill', () => {
  it('reflects selected state via aria-pressed', () => {
    render(<Pill selected>Medium</Pill>);
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('defaults to unselected', () => {
    render(<Pill>Light</Pill>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('meets the 44px minimum touch target height (ADR-024)', () => {
    render(<Pill>Light</Pill>);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Pill onClick={onClick}>Heavy</Pill>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <div role="group" aria-label="Flow">
        <Pill selected>Medium</Pill>
        <Pill>Light</Pill>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
