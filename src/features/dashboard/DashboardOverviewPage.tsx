import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Stack,
  TablePagination,
} from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from 'recharts';
import { useEndpoints } from '../endpoints/hooks/useEndpoints';
import { useExecutions } from '../executions/hooks/useExecutions';
import { MetricCard } from '@/components/common/MetricCard';
import { StatusChip } from '@/components/common/StatusChip';
import { formatLatency, formatRelativeTime } from '@/lib/formatters';
import { CronScheduleModal } from './components/CronScheduleModal';
import { useCronSchedule } from './hooks/useCronSchedule';

export const DashboardOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { endpoints, isLoading: isEndpointsLoading } = useEndpoints();
  const { executions, isLoading: isExecutionsLoading } = useExecutions();
  const [cronModalOpen, setCronModalOpen] = React.useState(false);
  const { humanLabel: cronCadenceLabel } = useCronSchedule();

  const activeEndpoints = endpoints.filter((e) => e.is_enabled);
  const pausedEndpoints = endpoints.filter((e) => !e.is_enabled);

  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((x) => x.success).length;
  const failureExecutions = totalExecutions - successfulExecutions;
  const successRate =
    totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100;

  const totalLatency = executions.reduce((acc, curr) => acc + (curr.response_time_ms || 0), 0);
  const avgLatency = totalExecutions > 0 ? Math.round(totalLatency / totalExecutions) : 0;

  const recentFailures = executions.filter((x) => !x.success);
  const [incidentPage, setIncidentPage] = React.useState<number>(0);
  const [incidentRowsPerPage, setIncidentRowsPerPage] = React.useState<number>(5);

  const safeIncidentPage = Math.min(
    incidentPage,
    Math.max(0, Math.ceil(recentFailures.length / incidentRowsPerPage) - 1)
  );
  const paginatedIncidents = recentFailures.slice(
    safeIncidentPage * incidentRowsPerPage,
    safeIncidentPage * incidentRowsPerPage + incidentRowsPerPage
  );

  // Latency trends for Recharts
  const latencyData = [...executions]
    .reverse()
    .slice(-15)
    .map((x, i) => ({
      index: i + 1,
      latency: x.response_time_ms,
      time: new Date(x.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

  // Hourly volume breakdown
  const volumeData = [
    { name: 'Healthy (2xx)', count: successfulExecutions, fill: '#10B981' },
    { name: 'Failed (4xx/5xx/Net)', count: failureExecutions, fill: '#EF4444' },
  ];

  const isLoading = isEndpointsLoading || isExecutionsLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Top Banner */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3.5,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.125rem' } }}
          >
            VigilAPI Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Autonomous serverless monitoring health and performance metrics.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={<ScheduleIcon />}
            onClick={() => setCronModalOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
          >
            Cadence: {cronCadenceLabel}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/endpoints')}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
          >
            Add Monitored API
          </Button>
        </Box>
      </Box>

      {/* 4 Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Configured Endpoints"
            value={endpoints.length}
            subtext={`${activeEndpoints.length} Active • ${pausedEndpoints.length} Paused`}
            icon={<SensorsIcon />}
            colorVariant="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Success Rate"
            value={`${successRate}%`}
            subtext={`${successfulExecutions} passed of ${totalExecutions} runs`}
            icon={<CheckCircleOutlineIcon />}
            colorVariant={successRate >= 95 ? 'success' : 'warning'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Latency"
            value={formatLatency(avgLatency)}
            subtext="Across all monitored targets"
            icon={<SpeedIcon />}
            colorVariant="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Recorded Executions"
            value={totalExecutions}
            subtext="Retained within 7-day window"
            icon={<HistoryToggleOffIcon />}
            colorVariant="primary"
          />
        </Grid>
      </Grid>

      {/* Visual Analytics Charts */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Latency History Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: '100%', p: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Response Latency Trend (ms)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Real-time latency trajectory for recent executions.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                {latencyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                      <XAxis dataKey="time" stroke="#6B7280" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#6B7280"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: 8,
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                        }}
                        itemStyle={{ color: '#F9FAFB', fontSize: '0.875rem' }}
                        labelStyle={{ color: '#F9FAFB', fontWeight: 700, marginBottom: 4 }}
                        formatter={(v: any) => [`${v}ms`, 'Latency']}
                      />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#latencyGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Awaiting initial execution metrics...
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Success vs Failure Bar Chart */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%', p: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Health Breakdown
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Distribution of execution outcomes.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#6B7280"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => (isMobile ? (v.startsWith('Healthy') ? 'Healthy' : 'Failed') : v)}
                    />
                    <YAxis stroke="#6B7280" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: 8,
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                      }}
                      itemStyle={{ color: '#F9FAFB', fontSize: '0.875rem' }}
                      labelStyle={{ color: '#F9FAFB', fontWeight: 700, marginBottom: 4 }}
                      formatter={(v: any) => [`${v} runs`, 'Volume']}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Failures Live Card */}
      <Card sx={{ p: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorOutlineIcon sx={{ color: '#EF4444' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Recent Incident Alerts
              </Typography>
            </Box>

            <Button size="small" onClick={() => navigate('/executions')}>
              View Full History
            </Button>
          </Box>

          {recentFailures.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
                All systems optimal. Zero execution failures detected in recent window.
              </Typography>
            </Box>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {paginatedIncidents.map((rf) => (
                <Box
                  key={rf.id}
                  sx={{
                    p: 1.5,
                    border: '1px solid #1F2937',
                    borderRadius: 2,
                    backgroundColor: 'rgba(239, 68, 68, 0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(rf.started_at)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>
                      {formatLatency(rf.response_time_ms)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <StatusChip type="http-status" value={rf.status_code} />
                    <Chip
                      label={rf.error_category || 'ERROR'}
                      size="small"
                      color="error"
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="caption" sx={{ color: '#EF4444', wordBreak: 'break-word', display: 'block' }}>
                    {rf.sanitized_error_message || 'Non-2xx response received'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>HTTP Status</TableCell>
                    <TableCell>Error Category</TableCell>
                    <TableCell>Sanitized Error Diagnostic</TableCell>
                    <TableCell align="right">Latency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedIncidents.map((rf) => (
                    <TableRow key={rf.id} hover>
                      <TableCell>{formatRelativeTime(rf.started_at)}</TableCell>
                      <TableCell>
                        <StatusChip type="http-status" value={rf.status_code} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rf.error_category || 'ERROR'}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#EF4444', maxWidth: 300, wordBreak: 'break-word' }}>
                        {rf.sanitized_error_message || 'Non-2xx response received'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatLatency(rf.response_time_ms)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {recentFailures.length > 0 && (
            <TablePagination
              component="div"
              count={recentFailures.length}
              page={safeIncidentPage}
              onPageChange={(_, newPage) => setIncidentPage(newPage)}
              rowsPerPage={incidentRowsPerPage}
              onRowsPerPageChange={(e) => {
                setIncidentRowsPerPage(parseInt(e.target.value, 10));
                setIncidentPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
              labelRowsPerPage="Rows per page:"
              sx={{
                borderTop: '1px solid #1F2937',
                color: '#9CA3AF',
                mt: 1.5,
                '.MuiTablePagination-toolbar': {
                  flexWrap: 'wrap',
                  justifyContent: { xs: 'center', sm: 'flex-end' },
                  gap: { xs: 0.5, sm: 0 },
                  px: { xs: 1, sm: 2 },
                  minHeight: { xs: 48, sm: 52 },
                },
                '.MuiTablePagination-selectLabel': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  color: '#9CA3AF',
                },
                '.MuiTablePagination-select': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  color: '#F9FAFB',
                },
                '.MuiTablePagination-displayedRows': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  color: '#9CA3AF',
                },
                '.MuiTablePagination-actions': {
                  ml: { xs: 0.5, sm: 1.5 },
                  color: '#9CA3AF',
                },
              }}
            />
          )}
        </CardContent>
      </Card>

      <CronScheduleModal open={cronModalOpen} onClose={() => setCronModalOpen(false)} />
    </Box>
  );
};
