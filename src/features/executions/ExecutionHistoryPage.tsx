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
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useExecutions } from './hooks/useExecutions';
import { useEndpoints } from '../endpoints/hooks/useEndpoints';
import { ExecutionDetailModal } from './ExecutionDetailModal';
import { StatusChip } from '@/components/common/StatusChip';
import { formatDateTime, formatRelativeTime, formatLatency } from '@/lib/formatters';
import type { EndpointExecution } from '@/types';

export const ExecutionHistoryPage: React.FC = () => {
  const { endpoints } = useEndpoints();
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [activeExecution, setActiveExecution] = useState<EndpointExecution | null>(null);

  const { executions, isLoading } = useExecutions({
    endpointId: selectedEndpointId === 'all' ? undefined : selectedEndpointId,
    status: statusFilter,
  });

  const endpointMap = new Map(endpoints.map((ep) => [ep.id, ep]));

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Execution History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Audit logs and telemetry captured by the serverless dispatcher. Retained for 7 days.
        </Typography>
      </Box>

      {/* Filter Toolbar */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
          }}
        >
          <Tabs
            value={statusFilter}
            onChange={(_, val) => setStatusFilter(val)}
            sx={{ minHeight: 40 }}
          >
            <Tab label="All Results" value="all" sx={{ minHeight: 40, py: 0.5 }} />
            <Tab label="Passed" value="success" sx={{ minHeight: 40, py: 0.5 }} />
            <Tab label="Failed" value="failure" sx={{ minHeight: 40, py: 0.5 }} />
          </Tabs>

          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Filter By Endpoint</InputLabel>
            <Select
              value={selectedEndpointId}
              label="Filter By Endpoint"
              onChange={(e) => setSelectedEndpointId(e.target.value)}
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

      {/* History Table */}
      <Card>
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
        ) : (
          <TableContainer>
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
                {executions.map((x) => {
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
