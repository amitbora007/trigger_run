import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '../../src/app/theme';
import { DashboardOverviewPage } from '../../src/features/dashboard/DashboardOverviewPage';
import { ExecutionHistoryPage } from '../../src/features/executions/ExecutionHistoryPage';
import { EndpointsListPage } from '../../src/features/endpoints/EndpointsListPage';
import { AnalyticsPage } from '../../src/features/analytics/AnalyticsPage';
const mockEndpoints = Array.from({ length: 15 }, (_, i) => ({
    id: `ep-${i + 1}`,
    user_id: 'user-1',
    name: `API Service ${i + 1}`,
    endpoint_url: `https://api.example.com/health/${i + 1}`,
    method: 'GET',
    interval_seconds: 300,
    request_timeout_ms: 5000,
    query_params: {},
    headers: {},
    is_enabled: i % 2 === 0,
    notify_on_failure: true,
    notification_email: null,
    last_alert_sent_at: null,
    next_run_at: new Date(Date.now() + 60000).toISOString(),
    last_run_at: new Date(Date.now() - 60000).toISOString(),
    lease_expires_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
}));
const mockExecutions = Array.from({ length: 25 }, (_, i) => ({
    id: `exec-${i + 1}`,
    endpoint_id: `ep-${(i % 15) + 1}`,
    user_id: 'user-1',
    scheduled_at: new Date(Date.now() - i * 60000).toISOString(),
    started_at: new Date(Date.now() - i * 60000).toISOString(),
    completed_at: new Date(Date.now() - i * 60000 + 150).toISOString(),
    status_code: 200,
    response_time_ms: 100 + i * 10,
    success: true,
    error_category: null,
    sanitized_error_message: null,
    response_headers: {},
    response_body: '{"status":"ok"}',
    is_truncated: false,
    correlation_id: `corr-${i + 1}`,
    created_at: new Date(Date.now() - i * 60000).toISOString(),
}));
const mockExecutionsWithFailures = Array.from({ length: 25 }, (_, i) => ({
    id: `exec-${i + 1}`,
    endpoint_id: `ep-${(i % 15) + 1}`,
    user_id: 'user-1',
    scheduled_at: new Date(Date.now() - i * 60000).toISOString(),
    started_at: new Date(Date.now() - i * 60000).toISOString(),
    completed_at: new Date(Date.now() - i * 60000 + 150).toISOString(),
    status_code: i < 12 ? 500 : 200,
    response_time_ms: 100 + i * 10,
    success: i >= 12,
    error_category: i < 12 ? 'HTTP_ERROR' : null,
    sanitized_error_message: i < 12 ? 'Internal Server Error' : null,
    response_headers: {},
    response_body: i < 12 ? '{"error":"fail"}' : '{"status":"ok"}',
    is_truncated: false,
    correlation_id: `corr-${i + 1}`,
    created_at: new Date(Date.now() - i * 60000).toISOString(),
}));
let currentExecutions = mockExecutions;
vi.mock('../../src/features/endpoints/hooks/useEndpoints', () => ({
    useEndpoints: () => ({
        endpoints: mockEndpoints,
        isLoading: false,
        refetch: vi.fn(),
        createEndpoint: vi.fn(),
        updateEndpoint: vi.fn(),
        toggleEndpoint: vi.fn(),
        deleteEndpoint: vi.fn(),
    }),
}));
vi.mock('../../src/features/executions/hooks/useExecutions', () => ({
    useExecutions: () => ({
        executions: currentExecutions,
        isLoading: false,
        refetch: vi.fn(),
        triggerTestRun: vi.fn(),
    }),
}));
vi.mock('../../src/features/dashboard/hooks/useCronSchedule', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useCronSchedule: () => ({
            schedule: '*/4 * * * *',
            humanLabel: 'Every 4 minutes',
            isLoading: false,
            updateSchedule: vi.fn(),
        }),
    };
});
function renderWithTheme(ui) {
    return render(<MemoryRouter>
      <ThemeProvider theme={appTheme}>{ui}</ThemeProvider>
    </MemoryRouter>);
}
describe('Pagination Controls and Behavior', () => {
    describe('ExecutionHistoryPage Pagination', () => {
        it('renders execution history with pagination controls and limits to rowsPerPage', () => {
            renderWithTheme(<ExecutionHistoryPage />);
            expect(screen.getByText('Execution History')).toBeInTheDocument();
            // Total 25 executions with 10 per page => displayed: 1–10 of 25
            expect(screen.getByText(/1–10 of 25/i)).toBeInTheDocument();
            expect(screen.getByText(/Rows per page:/i)).toBeInTheDocument();
        });
        it('navigates to next page on pagination button click', () => {
            renderWithTheme(<ExecutionHistoryPage />);
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/11–20 of 25/i)).toBeInTheDocument();
        });
        it('resets page when status filter changes', () => {
            renderWithTheme(<ExecutionHistoryPage />);
            // Go to page 2
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/11–20 of 25/i)).toBeInTheDocument();
            // Click "Passed" tab
            const passedTab = screen.getByRole('tab', { name: /Passed/i });
            fireEvent.click(passedTab);
            // Verify reset back to page 1
            expect(screen.getByText(/1–10 of 25/i)).toBeInTheDocument();
        });
    });
    describe('EndpointsListPage Pagination', () => {
        it('renders endpoints list with pagination controls and limits to rowsPerPage', () => {
            renderWithTheme(<EndpointsListPage />);
            expect(screen.getByText('Monitored Endpoints')).toBeInTheDocument();
            // Total 15 endpoints with 10 per page => 1–10 of 15
            expect(screen.getByText(/1–10 of 15/i)).toBeInTheDocument();
            expect(screen.getByText(/Rows per page:/i)).toBeInTheDocument();
        });
        it('navigates to next page for endpoints', () => {
            renderWithTheme(<EndpointsListPage />);
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/11–15 of 15/i)).toBeInTheDocument();
        });
        it('resets page when filter tab changes', () => {
            renderWithTheme(<EndpointsListPage />);
            // Go to page 2
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/11–15 of 15/i)).toBeInTheDocument();
            // Click "Active" tab
            const activeTab = screen.getByRole('tab', { name: /Active/i });
            fireEvent.click(activeTab);
            // Verify reset back to page 1
            expect(screen.getByText(/1–/i)).toBeInTheDocument();
        });
        it('resets page when search query changes', () => {
            renderWithTheme(<EndpointsListPage />);
            // Go to page 2
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/11–15 of 15/i)).toBeInTheDocument();
            // Search
            const searchInput = screen.getByPlaceholderText(/Search endpoints/i);
            fireEvent.change(searchInput, { target: { value: 'API Service 1' } });
            // Verify reset
            expect(screen.getByText(/1–/i)).toBeInTheDocument();
        });
    });
    describe('AnalyticsPage Audit Summary Pagination', () => {
        it('renders Endpoint Telemetry Audit Summary with pagination controls', () => {
            renderWithTheme(<AnalyticsPage />);
            expect(screen.getByText('Endpoint Telemetry Audit Summary')).toBeInTheDocument();
            // 15 endpoints with 5 per page => 1–5 of 15
            expect(screen.getByText(/1–5 of 15/i)).toBeInTheDocument();
            expect(screen.getByText(/Rows per page:/i)).toBeInTheDocument();
        });
        it('navigates through audit summary pages', () => {
            renderWithTheme(<AnalyticsPage />);
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/6–10 of 15/i)).toBeInTheDocument();
        });
    });
    describe('DashboardOverviewPage Recent Incident Alerts Pagination', () => {
        beforeEach(() => {
            currentExecutions = mockExecutionsWithFailures;
        });
        afterEach(() => {
            currentExecutions = mockExecutions;
        });
        it('renders Recent Incident Alerts with pagination controls and limits to 5 per page', () => {
            renderWithTheme(<DashboardOverviewPage />);
            expect(screen.getByText('Recent Incident Alerts')).toBeInTheDocument();
            // 12 failures with 5 per page => 1–5 of 12
            expect(screen.getByText(/1–5 of 12/i)).toBeInTheDocument();
            expect(screen.getByText(/Rows per page:/i)).toBeInTheDocument();
        });
        it('navigates through incident alert pages', () => {
            renderWithTheme(<DashboardOverviewPage />);
            const nextPageBtn = screen.getByTitle(/Go to next page/i);
            fireEvent.click(nextPageBtn);
            expect(screen.getByText(/6–10 of 12/i)).toBeInTheDocument();
        });
    });
});
