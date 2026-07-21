import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './Dashboard';
import { describe, expect, it } from 'vitest';

describe('Dashboard', () => {
  it('renders the usable Nexus workspace', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Dashboard />
      </QueryClientProvider>
    );
    expect(screen.getByText('Nexus Academy')).toBeTruthy();
    expect(screen.getByText('Linear Equation Repair')).toBeTruthy();
  });
});

