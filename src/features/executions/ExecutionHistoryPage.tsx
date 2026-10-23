import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  CircularProgress,
  Button,
  Chip,
  Stack,
  Divider,
  TablePagination,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useExecutions } from './hooks/useExecutions';
import { useEndpoints } from '../endpoints/hooks/useEndpoints';
import { ExecutionDetailModal } from './ExecutionDetailModal';
import { StatusChip } from '@/components/common/StatusChip';
import { formatDateTime, formatRelativeTime, formatLatency } from '@/lib/formatters';
import type { EndpointExecution } from '@/types';

export const ExecutionHistoryPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { endpoints } = useEndpoints();
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [activeExecution, setActiveExecution] = useState<EndpointExecution | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const { executions, isLoading } = useExecutions({
    endpointId: selectedEndpointId === 'all' ? undefined : selectedEndpointId,
    status: statusFilter,
  });

  const endpointMap = new Map(endpoints.map((ep) => [ep.id, ep]));

  const handleStatusFilterChange = (val: 'all' | 'success' | 'failure') => {
    setStatusFilter(val);
    setPage(0);
  };

  const handleEndpointFilterChange = (val: string) => {
    setSelectedEndpointId(val);
    setPage(0);
  };

  const safePage = Math.min(page, Math.max(0, Math.ceil(executions.length / rowsPerPage) - 1));
  const paginatedExecutions = executions.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.125rem' } }}
        >
          Execution History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Audit logs and telemetry captured by the serverless dispatcher. Retained for 7 days.
        </Typography>
      </Box>

      {/* Filter Toolbar */}
      <Card sx={{ mb: 3, p: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2,
          }}
        >
          <Tabs
            value={statusFilter}
            onChange={(_, val) => handleStatusFilterChange(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ minHeight: 40 }}
          >
            <Tab label="All Results" value="all" sx={{ minHeight: 40, py: 0.5 }} />
            <Tab label="Passed" value="success" sx={{ minHeight: 40, py: 0.5 }} />
            <Tab label="Failed" value="failure" sx={{ minHeight: 40, py: 0.5 }} />
          </Tabs>

          <FormControl size="small" sx={{ width: { xs: '100%', md: 280 } }}>
            <InputLabel>Filter By Endpoint</InputLabel>
            <Select
              value={selectedEndpointId}
              label="Filter By Endpoint"
              onChange={(e) => handleEndpointFilterChange(e.target.value)}
            >
              <MenuItem value="all">All Configured Endpoints</MenuItem>
              {endpoints.map((ep) => (
                <MenuItem key={ep.id} value={ep.id}>
                  {ep.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Content: Cards on Mobile / Table on Desktop */}
      <Card sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : executions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
              No execution records match current filters
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Executions will appear here once the minute dispatcher runs or when you trigger a manual test.
            </Typography>
          </Box>
        ) : isMobile ? (
          /* Mobile Adaptive Cards */
          <Stack spacing={2} sx={{ p: 1.5 }}>
            {paginatedExecutions.map((x) => {
              const ep = endpointMap.get(x.endpoint_id);
              return (
                <Card
                  key={x.id}
                  sx={{
                    p: 2,
                    border: '1px solid #1F2937',
                    backgroundColor: '#111827',
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#374151' },
                  }}
                  onClick={() => setActiveExecution(x)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, color: '#F9FAFB', wordBreak: 'break-word', lineHeight: 1.3 }}
                      >
                        {ep?.name || 'Deleted / Unknown Endpoint'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {formatRelativeTime(x.started_at)} • {formatDateTime(x.started_at)}
                      </Typography>
                    </Box>
                    <StatusChip type="execution-result" value={x.success} />
                  </Box>

                  <Divider sx={{ my: 1.5, borderColor: '#1F2937' }} />

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <StatusChip type="http-status" value={x.status_code} />
                    <Chip
                      label={formatLatency(x.response_time_ms)}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: '#374151', fontWeight: 600 }}
                    />
                    {x.error_category ? (
                      <Chip
                        label={x.error_category}
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        label="Healthy"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {x.sanitized_error_message && !x.success && (
                    <Box sx={{ p: 1.25, mb: 1.5, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#EF4444', wordBreak: 'break-word', display: 'block' }}>
                        {x.sanitized_error_message}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1, borderTop: '1px solid #1F2937' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveExecution(x);
                      }}
                      sx={{ borderColor: '#374151', color: '#9CA3AF', width: { xs: '100%', sm: 'auto' }, minHeight: 36 }}
                    >
                      Details & Telemetry
                    </Button>
                  </Box>
                </Card>
              );
            })}
          </Stack>
        ) : (
          /* Desktop Table View */
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp (UTC)</TableCell>
                  <TableCell>Endpoint</TableCell>
                  <TableCell>HTTP Status</TableCell>
                  <TableCell>Latency</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Diagnostic</TableCell>
                  <TableCell align="right">Inspector</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedExecutions.map((x) => {
                  const ep = endpointMap.get(x.endpoint_id);
                  return (
                    <TableRow
                      key={x.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setActiveExecution(x)}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatRelativeTime(x.started_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(x.started_at)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#F9FAFB' }}>
                          {ep?.name || 'Deleted / Unknown Endpoint'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <StatusChip type="http-status" value={x.status_code} />
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatLatency(x.response_time_ms)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <StatusChip type="execution-result" value={x.success} />
                      </TableCell>

                      <TableCell>
                        {x.error_category ? (
                          <Typography
                            variant="caption"
                            sx={{ color: '#EF4444', fontWeight: 600 }}
                          >
                            {x.error_category}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Healthy
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveExecution(x);
                          }}
                          sx={{ borderColor: '#374151', color: '#9CA3AF' }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {executions.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={executions.length}
            rowsPerPage={rowsPerPage}
            page={safePage}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{
              borderTop: '1px solid #1F2937',
              color: '#9CA3AF',
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
      </Card>

      {/* Execution Detail Drawer */}
      <ExecutionDetailModal
        open={Boolean(activeExecution)}
        execution={activeExecution}
        endpointName={
          activeExecution ? endpointMap.get(activeExecution.endpoint_id)?.name : undefined
        }
        onClose={() => setActiveExecution(null)}
      />
    </Box>
  );
};
