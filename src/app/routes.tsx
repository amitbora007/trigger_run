import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardOverviewPage } from '@/features/dashboard/DashboardOverviewPage';
import { EndpointsListPage } from '@/features/endpoints/EndpointsListPage';
import { ExecutionHistoryPage } from '@/features/executions/ExecutionHistoryPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardOverviewPage />} />
          <Route path="/endpoints" element={<EndpointsListPage />} />
          <Route path="/executions" element={<ExecutionHistoryPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
