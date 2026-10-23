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
      {/* System Status HUD Pill */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.75,
          py: 0.65,
          borderRadius: 2,
          backgroundColor: recentFailures.length === 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: recentFailures.length === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.35)',
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: recentFailures.length === 0 ? '#10B981' : '#EF4444',
            animation: 'vigilPulse 2s infinite',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: recentFailures.length === 0 ? '#10B981' : '#F87171',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: '0.72rem',
          }}
        >
          {recentFailures.length === 0 ? 'All Systems Nominal // Watchdog Armed' : `${recentFailures.length} Incidents In Audit Window`}
        </Typography>
      </Box>

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
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.6rem', sm: '1.95rem', md: '2.25rem' },
              letterSpacing: '-0.03em',
            }}
          >
            VigilAPI Overview
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.25 }}>
            Autonomous serverless monitoring health and performance telemetry.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={<ScheduleIcon sx={{ color: '#10B981' }} />}
            onClick={() => setCronModalOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 42 }}
          >
            Cadence: {cronCadenceLabel}
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/endpoints')}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 42 }}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
                  Response Latency Trend (ms)
                </Typography>
                <Chip
                  label="Real-time"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10B981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 2 }}>
                Real-time latency trajectory for recent executions across all targets.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                {latencyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                          <stop offset="60%" stopColor="#10B981" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} fontFamily='"JetBrains Mono", monospace' />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        fontFamily='"JetBrains Mono", monospace'
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(10, 15, 29, 0.92)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: 10,
                          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.7), 0 0 15px rgba(16, 185, 129, 0.2)',
                          fontFamily: '"JetBrains Mono", monospace',
                        }}
                        itemStyle={{ color: '#10B981', fontSize: '0.875rem', fontWeight: 600 }}
                        labelStyle={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 4 }}
                        formatter={(v: any) => [`${v} ms`, 'Response Time']}
                      />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#latencyGradient)"
                        filter="drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))"
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
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em', mb: 0.5 }}>
                Health Breakdown
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 2 }}>
                Distribution of execution outcomes across all targets.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => (isMobile ? (v.startsWith('Healthy') ? 'Healthy' : 'Failed') : v)}
                    />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} fontFamily='"JetBrains Mono", monospace' />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(10, 15, 29, 0.92)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 10,
                        boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.7)',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                      itemStyle={{ color: '#F8FAFC', fontSize: '0.875rem' }}
                      labelStyle={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 4 }}
                      formatter={(v: any) => [`${v} runs`, 'Volume']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} />
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
              <ErrorOutlineIcon sx={{ color: recentFailures.length > 0 ? '#EF4444' : '#10B981' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
                Recent Incident Alerts
              </Typography>
              {recentFailures.length > 0 && (
                <Chip
                  label={`${recentFailures.length} Incidents`}
                  size="small"
                  color="error"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              )}
            </Box>

            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/executions')}
              sx={{ fontSize: '0.78rem' }}
            >
              View Full History
            </Button>
          </Box>

          {recentFailures.length === 0 ? (
            <Box
              sx={{
                py: 4.5,
                textAlign: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.03)',
                borderRadius: 2,
                border: '1px dashed rgba(16, 185, 129, 0.25)',
              }}
            >
              <CheckCircleOutlineIcon sx={{ color: '#10B981', fontSize: 32, mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 700 }}>
                All systems optimal. Zero execution failures detected in recent window.
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
                Dispatcher actively auditing all endpoints according to pg_cron cadence.
              </Typography>
            </Box>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {paginatedIncidents.map((rf) => (
                <Box
                  key={rf.id}
                  sx={{
                    p: 1.75,
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 2.5,
                    backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: '"JetBrains Mono", monospace' }}>
                      {formatRelativeTime(rf.started_at)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981', fontFamily: '"JetBrains Mono", monospace' }}>
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
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                  </Box>

                  <Typography variant="caption" sx={{ color: '#F87171', wordBreak: 'break-word', display: 'block', fontFamily: '"JetBrains Mono", monospace' }}>
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
                    <TableRow key={rf.id} hover sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } }}>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem', color: '#94A3B8' }}>
                        {formatRelativeTime(rf.started_at)}
                      </TableCell>
                      <TableCell>
                        <StatusChip type="http-status" value={rf.status_code} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rf.error_category || 'ERROR'}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#F87171', maxWidth: 320, wordBreak: 'break-word', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.78rem' }}>
                        {rf.sanitized_error_message || 'Non-2xx response received'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#10B981' }}>
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
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
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
                  color: '#94A3B8',
                },
                '.MuiTablePagination-select': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  color: '#F8FAFC',
                },
                '.MuiTablePagination-displayedRows': {
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  color: '#94A3B8',
                },
                '.MuiTablePagination-actions': {
                  ml: { xs: 0.5, sm: 1.5 },
                  color: '#94A3B8',
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
