import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EndpointFormModal } from '../../src/features/endpoints/EndpointFormModal';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '../../src/app/theme';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={appTheme}>{ui}</ThemeProvider>);
}

describe('EndpointFormModal Component', () => {
  it('renders form fields correctly in create mode', () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    renderWithTheme(
      <EndpointFormModal
        open={true}
        endpoint={null}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    expect(screen.getByText('Create New Monitored Endpoint')).toBeInTheDocument();
    expect(screen.getByLabelText(/Endpoint Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target HTTP GET URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Custom Interval/i)).toBeInTheDocument();
  });

  it('rejects submission when URL is invalid or attempts SSRF', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    renderWithTheme(
      <EndpointFormModal
        open={true}
        endpoint={null}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    // Enter name
    fireEvent.change(screen.getByLabelText(/Endpoint Name/i), {
      target: { value: 'Metadata Exploit Test' },
    });

    // Enter SSRF restricted URL
    fireEvent.change(screen.getByLabelText(/Target HTTP GET URL/i), {
      target: { value: 'http://169.254.169.254/latest/meta-data/' },
    });

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /Save & Activate/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid or restricted URL/i)
      ).toBeInTheDocument();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  it('allows selecting interval presets like 5m and 1h', () => {
    renderWithTheme(
      <EndpointFormModal
        open={true}
        endpoint={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const preset1h = screen.getByText('1h');
    fireEvent.click(preset1h);

    const intervalInput = screen.getByLabelText(/Custom Interval/i) as HTMLInputElement;
    expect(intervalInput.value).toBe('3600');
  });

  it('submits valid endpoint configuration', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(true);
    const handleClose = vi.fn();

    renderWithTheme(
      <EndpointFormModal
        open={true}
        endpoint={null}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/Endpoint Name/i), {
      target: { value: 'Valid Production Check' },
    });

    fireEvent.change(screen.getByLabelText(/Target HTTP GET URL/i), {
      target: { value: 'https://httpbin.org/get' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save & Activate/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Valid Production Check',
          endpoint_url: 'https://httpbin.org/get',
          interval_seconds: 300,
          is_enabled: true,
        })
      );
    });
  });
});
