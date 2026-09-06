import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Switch } from './switch';

describe('Switch', () => {
  it('toggles checked state on click', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Enable PIN lock" />);
    const toggle = screen.getByRole('switch', { name: 'Enable PIN lock' });
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('data-state', 'checked');
  });

  it('renders at the ADR-024 51×31px exception size, not the 44px default', () => {
    render(<Switch aria-label="Enable PIN lock" />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass('h-[31px]', 'w-[51px]');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Switch aria-label="Enable PIN lock" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
