// App smoke test — boots from (fake) IndexedDB with no settings ever saved,
// so it should land on the real Onboarding screen behind the gate.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import App from './App';

describe('App', () => {
  it('boots to Onboarding when no settings have ever been saved', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: "Let's set up Moonflow" })).toBeInTheDocument();
  });
});
