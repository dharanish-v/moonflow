import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('marks the active tab for the current route', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('text-primary');
  });

  it('hides entirely on /log — no tab bar exists to make the sheet feel non-modal', () => {
    render(
      <MemoryRouter initialEntries={['/log']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('every tab meets the 44px touch target minimum (ADR-024) — not the vanilla app\'s original 19px icons', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    );
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('size-11');
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
