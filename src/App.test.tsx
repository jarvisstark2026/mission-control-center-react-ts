import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the mission control workspace shell', () => {
    render(<App />);

    expect(screen.getAllByText('Mission Control Center').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mission Control Center shell')).toBeInTheDocument();
    expect(screen.getAllByText('Command core').length).toBeGreaterThan(0);
  });
});
