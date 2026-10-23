import React, { useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, TablePagination, useMediaQuery, useTheme, Stack, Chip, } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, } from 'recharts';
import { useExecutions } from '../executions/hooks/useExecutions';
import { useEndpoints } from '../endpoints/hooks/useEndpoints';
import { MetricCard } from '@/components/common/MetricCard';
import SpeedIcon from '@mui/icons-material/Speed';
import TimerIcon from '@mui/icons-material/Timer';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { formatLatency } from '@/lib/formatters';
const ERROR_COLORS = ['#EF4444', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];
export const AnalyticsPage = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { endpoints, isLoading: isEndpointsLoading } = useEndpoints();
    const { executions, isLoading: isExecutionsLoading } = useExecutions();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    // Calculate Percentiles
    const sortedLatencies = [...executions]
        .map((x) => x.response_time_ms)
        .filter((n) => typeof n === 'number')
        .sort((a, b) => a - b);
    const getPercentile = (p) => {
        if (sortedLatencies.length === 0)
            return 0;
        const index = Math.floor((p / 100) * sortedLatencies.length);
        return sortedLatencies[Math.min(index, sortedLatencies.length - 1)];
    };
    const p50 = getPercentile(50);
    const p90 = getPercentile(90);
    const p99 = getPercentile(99);
    // Group errors by category
    const errorMap = {};
    executions
        .filter((x) => !x.success)
        .forEach((x) => {
        const cat = x.error_category || 'UNKNOWN';
        errorMap[cat] = (errorMap[cat] || 0) + 1;
    });
    const errorData = Object.entries(errorMap).map(([name, value]) => ({ name, value }));
    // Group stats per endpoint
    const statsPerEndpoint = endpoints.map((ep) => {
        const epExecutions = executions.filter((x) => x.endpoint_id === ep.id);
        const total = epExecutions.length;
        const passed = epExecutions.filter((x) => x.success).length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
        const latencies = epExecutions.map((x) => x.response_time_ms);
        const avg = total > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / total) : 0;
        const max = total > 0 ? Math.max(...latencies) : 0;
        return {
            id: ep.id,
            name: ep.name,
            total,
            passRate,
            avgLatency: avg,
            maxLatency: max,
        };
    });
    const safePage = Math.min(page, Math.max(0, Math.ceil(statsPerEndpoint.length / rowsPerPage) - 1));
    const paginatedStats = statsPerEndpoint.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);
    const isLoading = isEndpointsLoading || isExecutionsLoading;
    if (isLoading) {
        return (<Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress color="primary"/>
      </Box>);
    }
    return (<Box>
      <Box sx={{ mb: 3.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', sm: '1.95rem', md: '2.25rem' }, letterSpacing: '-0.03em' }}>
            Telemetry & Analytics
          </Typography>
          <Chip label="Statistical Engine" size="small" sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            color: '#818CF8',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontFamily: '"JetBrains Mono", monospace',
        }}/>
        </Box>
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          Deep-dive latency distributions, percentile thresholds, and error taxonomy telemetry.
        </Typography>
      </Box>

      {/* Latency Percentile Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={4}>
          <MetricCard title="p50 Latency (Median)" value={formatLatency(p50)} subtext="50% of requests complete faster than this" icon={<SpeedIcon />} colorVariant="primary"/>
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard title="p90 Latency" value={formatLatency(p90)} subtext="90% of requests complete faster than this" icon={<TimerIcon />} colorVariant="secondary"/>
        </Grid>
        <Grid item xs={12} sm={4}>
          <MetricCard title="p99 Latency (Tail)" value={formatLatency(p99)} subtext="Worst-case tail latency threshold" icon={<FlashOnIcon />} colorVariant="warning"/>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* Endpoint Comparison Bar Chart */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%', p: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em', mb: 0.5 }}>
                Average Latency By Endpoint (ms)
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 2 }}>
                Cross-service telemetry and execution benchmark comparison.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsPerEndpoint} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false}/>
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} tickFormatter={(v) => (v.length > (isMobile ? 8 : 15) ? `${v.slice(0, isMobile ? 8 : 15)}...` : v)}/>
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} fontFamily='"JetBrains Mono", monospace' tickFormatter={(v) => `${v}ms`}/>
                    <Tooltip contentStyle={{
            backgroundColor: 'rgba(10, 15, 29, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: 10,
            boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.7), 0 0 15px rgba(99, 102, 241, 0.2)',
            fontFamily: '"JetBrains Mono", monospace',
        }} itemStyle={{ color: '#818CF8', fontSize: '0.875rem', fontWeight: 600 }} labelStyle={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 4 }} formatter={(v) => [`${v} ms`, 'Avg Latency']}/>
                    <Bar dataKey="avgLatency" fill="#6366F1" radius={[6, 6, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Error Taxonomy Pie Chart */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%', p: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em', mb: 0.5 }}>
                Failure Taxonomy Breakdown
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 2 }}>
                Categorization of failed requests by diagnostic signature.
              </Typography>

              <Box sx={{ width: '100%', height: 260 }}>
                {errorData.length > 0 ? (<ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={errorData} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 60} outerRadius={isMobile ? 68 : 90} paddingAngle={5} dataKey="value" label={isMobile ? false : ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {errorData.map((_, index) => (<Cell key={`cell-${index}`} fill={ERROR_COLORS[index % ERROR_COLORS.length]}/>))}
                      </Pie>
                      <Tooltip contentStyle={{
                backgroundColor: 'rgba(10, 15, 29, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 10,
                boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.7)',
                fontFamily: '"JetBrains Mono", monospace',
            }} itemStyle={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.875rem' }} labelStyle={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 4 }} formatter={(value, name) => [`${value} failure${value > 1 ? 's' : ''}`, `${name}`]}/>
                    </PieChart>
                  </ResponsiveContainer>) : (<Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
            }}>
                    <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 700 }}>
                      Zero failure events recorded.
                    </Typography>
                  </Box>)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Endpoint Comparison Table */}
      <Card sx={{ p: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.015em', mb: 2 }}>
            Endpoint Telemetry Audit Summary
          </Typography>

          {isMobile ? (<Stack spacing={1.5}>
              {paginatedStats.map((row) => (<Box key={row.id} sx={{
                    p: 1.75,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2.5,
                    backgroundColor: 'rgba(10, 15, 29, 0.85)',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F8FAFC' }}>
                      {row.name}
                    </Typography>
                    <Chip label={`${row.passRate}% pass`} size="small" sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: row.passRate >= 95 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: row.passRate >= 95 ? '#10B981' : '#F59E0B',
                    border: row.passRate >= 95 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    fontFamily: '"JetBrains Mono", monospace',
                }}/>
                  </Box>
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                        Samples
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
                        {row.total}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                        Avg Latency
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: '#818CF8' }}>
                        {formatLatency(row.avgLatency)}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.68rem', fontWeight: 700 }}>
                        Worst Latency
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: '#F59E0B' }}>
                        {formatLatency(row.maxLatency)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>))}
            </Stack>) : (<TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Monitored Target</TableCell>
                    <TableCell>Recorded Samples</TableCell>
                    <TableCell>Availability (%)</TableCell>
                    <TableCell>Average Response</TableCell>
                    <TableCell align="right">Worst-Case Latency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedStats.map((row) => (<TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } }}>
                      <TableCell sx={{ fontWeight: 700, color: '#F8FAFC' }}>{row.name}</TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{row.total}</TableCell>
                      <TableCell>
                        <Chip label={`${row.passRate}%`} size="small" sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    backgroundColor: row.passRate >= 95 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: row.passRate >= 95 ? '#10B981' : '#F59E0B',
                    border: row.passRate >= 95 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    fontFamily: '"JetBrains Mono", monospace',
                }}/>
                      </TableCell>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', color: '#818CF8' }}>
                        {formatLatency(row.avgLatency)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#F59E0B' }}>
                        {formatLatency(row.maxLatency)}
                      </TableCell>
                    </TableRow>))}
                </TableBody>
              </Table>
            </TableContainer>)}

          {statsPerEndpoint.length > 0 && (<TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={statsPerEndpoint.length} rowsPerPage={rowsPerPage} page={safePage} onPageChange={(_, newPage) => setPage(newPage)} onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
            }} sx={{
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
            }}/>)}
        </CardContent>
      </Card>
    </Box>);
};
