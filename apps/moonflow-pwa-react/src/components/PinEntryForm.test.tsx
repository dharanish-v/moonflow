import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PinEntryForm } from './PinEntryForm';

describe('PinEntryForm keypad (T61)', () => {
  afterEach(() => vi.useRealTimers());

  it('enters a PIN from the on-screen keypad', () => {
    const onComplete = vi.fn();
    render(<PinEntryForm title="Enter your PIN" onComplete={onComplete} />);
    for (const d of ['1', '2', '3', '4']) fireEvent.click(screen.getByRole('button', { name: d }));
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('shows progress as dots and supports delete', () => {
    render(<PinEntryForm title="Enter your PIN" onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByRole('img', { name: '2 of 4 digits entered' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('img', { name: '1 of 4 digits entered' })).toBeInTheDocument();
  });

  it('does not summon the iOS keyboard (the keypad replaces it)', () => {
    render(<PinEntryForm title="Enter your PIN" onComplete={vi.fn()} />);
    expect(screen.getByLabelText('Enter your PIN')).toHaveAttribute('inputmode', 'none');
  });

  it('during a lockout, counts down live and disables entry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    render(<PinEntryForm title="Enter your PIN" onComplete={vi.fn()} lockedUntil={25_000} />);
    expect(screen.getByText('Too many attempts — try again in 15s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled();
    act(() => {
      vi.setSystemTime(19_000);
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Too many attempts — try again in 5s')).toBeInTheDocument();
    act(() => {
      vi.setSystemTime(25_000);
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: '5' })).toBeEnabled();
  });
});
