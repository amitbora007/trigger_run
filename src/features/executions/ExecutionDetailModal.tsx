import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Alert,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { JsonViewer } from '@/components/common/JsonViewer';
import { StatusChip } from '@/components/common/StatusChip';
import { formatDateTime, formatLatency } from '@/lib/formatters';
import type { EndpointExecution } from '@/types';

interface ExecutionDetailModalProps {
  open: boolean;
  execution: EndpointExecution | null;
  endpointName?: string;
  onClose: () => void;
}

export const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({
  open,
  execution,
  endpointName,
  onClose,
}) => {
  if (!execution) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 540 },
          maxWidth: '100vw',
          backgroundColor: '#111827',
          p: { xs: 2, sm: 3 },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ minWidth: 0, pr: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <StatusChip type="execution-result" value={execution.success} />
            <StatusChip type="http-status" value={execution.status_code} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, wordBreak: 'break-word' }}>
            {endpointName || 'Execution Telemetry'}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              color: '#9CA3AF',
              wordBreak: 'break-all',
              display: 'block',
            }}
          >
            Correlation: {execution.correlation_id}
          </Typography>
        </Box>

        <IconButton onClick={onClose} size="small" sx={{ p: 1 }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Stack spacing={3}>
        {/* Error Diagnostics if failed */}
        {!execution.success && (
          <Alert severity="error" sx={{ py: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {execution.error_category || 'EXECUTION_FAILURE'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-word' }}>
              {execution.sanitized_error_message || 'The request could not be completed.'}
            </Typography>
          </Alert>
        )}

        {/* Timings & Telemetry Table */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#9CA3AF' }}>
            EXECUTION TIMINGS
          </Typography>
          <TableContainer sx={{ border: '1px solid #1F2937', borderRadius: 2 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ color: '#9CA3AF', width: { xs: 110, sm: 140 }, fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    Response Latency
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#10B981', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    {formatLatency(execution.response_time_ms)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#9CA3AF', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    Scheduled At
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    {formatDateTime(execution.scheduled_at)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#9CA3AF', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    Started At
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    {formatDateTime(execution.started_at)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ color: '#9CA3AF', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    Completed At
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                    {formatDateTime(execution.completed_at)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Safe-listed Response Headers */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#9CA3AF' }}>
            RESPONSE HEADERS (ALLOWLISTED)
          </Typography>
          {Object.keys(execution.response_headers || {}).length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No response headers recorded.
            </Typography>
          ) : (
            <TableContainer sx={{ border: '1px solid #1F2937', borderRadius: 2 }}>
              <Table size="small">
                <TableBody>
                  {Object.entries(execution.response_headers).map(([key, val]) => (
                    <TableRow key={key}>
                      <TableCell
                        sx={{
                          color: '#9CA3AF',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.75rem',
                          width: { xs: 110, sm: 160 },
                          wordBreak: 'break-word',
                        }}
                      >
                        {key}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.75rem',
                          wordBreak: 'break-all',
                        }}
                      >
                        {val}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Response Body Inspector */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#9CA3AF' }}>
              RESPONSE BODY
            </Typography>
            {execution.is_truncated && (
              <Chip label="Truncated at 32 KB" size="small" color="warning" variant="outlined" />
            )}
          </Box>
          <JsonViewer
            data={execution.response_body}
            isTruncated={execution.is_truncated}
            maxHeight={400}
          />
        </Box>
      </Stack>
    </Drawer>
  );
};
