import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders page header', () => {
  render(<App />);
  const headerElement = screen.getByText(/EVE Online PLEX Market/i);
  expect(headerElement).toBeInTheDocument();
});
