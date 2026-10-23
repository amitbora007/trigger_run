import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronScheduleModal } from '../../src/features/dashboard/components/CronScheduleModal';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '../../src/app/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/features/auth/AuthContext';
import { supabase } from '../../src/lib/supabaseClient';
function renderWithProviders(ui) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return render(<QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider theme={appTheme}>{ui}</ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>);
}
describe('CronScheduleModal Component', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(supabase, 'rpc').mockResolvedValue({
            data: [{ schedule: '* * * * *', active: true }],
            error: null,
        });
    });
    it('renders modal with title, presets, and current cadence', () => {
        const handleClose = vi.fn();
        renderWithProviders(<CronScheduleModal open={true} onClose={handleClose}/>);
        expect(screen.getByText('Dispatcher Cron Cadence')).toBeInTheDocument();
        expect(screen.getAllByText('Every 1 minute').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Every 3 minutes')).toBeInTheDocument();
        expect(screen.getByText('Custom Cron Expression')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Schedule/i })).toBeInTheDocument();
    });
    it('allows selecting a preset and saving', async () => {
        vi.spyOn(supabase, 'rpc').mockReturnValue(Promise.resolve({ data: { success: true, schedule: '*/3 * * * *' }, error: null }));
        const handleClose = vi.fn();
        renderWithProviders(<CronScheduleModal open={true} onClose={handleClose}/>);
        // Click "Every 3 minutes"
        const threeMinOption = screen.getByText('Every 3 minutes');
        fireEvent.click(threeMinOption);
        // Click Save
        const saveButton = screen.getByRole('button', { name: /Save Schedule/i });
        fireEvent.click(saveButton);
        await waitFor(() => {
            expect(screen.getByText(/Dispatcher cadence successfully updated/i)).toBeInTheDocument();
        });
    });
    it('validates custom cron expression format', async () => {
        const handleClose = vi.fn();
        renderWithProviders(<CronScheduleModal open={true} onClose={handleClose}/>);
        // Select custom cron
        const customOption = screen.getByText('Custom Cron Expression');
        fireEvent.click(customOption);
        const input = screen.getByPlaceholderText('*/3 * * * *');
        fireEvent.change(input, { target: { value: 'invalid cron' } });
        // Click Save
        const saveButton = screen.getByRole('button', { name: /Save Schedule/i });
        fireEvent.click(saveButton);
        await waitFor(() => {
            expect(screen.getByText(/Cron expression must have exactly 5 space-separated fields/i)).toBeInTheDocument();
        });
    });
});
