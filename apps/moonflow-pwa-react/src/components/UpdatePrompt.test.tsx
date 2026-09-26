import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { announceUpdate } from '../lib/update-signal';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt (T77)', () => {
  it('stays hidden until a new version is waiting', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
  });

  it('offers the update, and applies it only when tapped', () => {
    const apply = vi.fn();
    render(<UpdatePrompt />);
    act(() => announceUpdate(apply));
    expect(screen.getByText(/new version is ready/i)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(apply).toHaveBeenCalled();
  });

  it('can be dismissed for now', () => {
    render(<UpdatePrompt />);
    act(() => announceUpdate(vi.fn()));
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
  });
});
