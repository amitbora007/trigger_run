import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
  Grid,
  Stack,
  Divider,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { useEndpoints } from './hooks/useEndpoints';
import { useExecutions } from '../executions/hooks/useExecutions';
import { EndpointFormModal } from './EndpointFormModal';
import { StatusChip } from '@/components/common/StatusChip';
import { formatInterval, formatRelativeTime, formatDateTime } from '@/lib/formatters';
import type { MonitoredEndpoint, EndpointFormData } from '@/types';

export const EndpointsListPage: React.FC = () => {
  const {
    endpoints,
    isLoading,
    refetch,
    createEndpoint,
    updateEndpoint,
    toggleEndpoint,
    deleteEndpoint,
  } = useEndpoints();

  const { triggerTestRun } = useExecutions();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'paused'>('all');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<MonitoredEndpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonitoredEndpoint | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredEndpoints = endpoints.filter((ep) => {
    const matchesSearch =
      ep.name.toLowerCase().includes(search.toLowerCase()) ||
      ep.endpoint_url.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterTab === 'active') return ep.is_enabled;
    if (filterTab === 'paused') return !ep.is_enabled;
    return true;
  });

  const handleFilterTabChange = (val: 'all' | 'active' | 'paused') => {
    setFilterTab(val);
    setPage(0);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredEndpoints.length / rowsPerPage) - 1));
  const paginatedEndpoints = filteredEndpoints.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage
  );

  const handleOpenCreate = () => {
    setEditingEndpoint(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (ep: MonitoredEndpoint) => {
    setEditingEndpoint(ep);
    setModalOpen(true);
  };

  const handleFormSubmit = async (data: EndpointFormData) => {
    if (editingEndpoint) {
      await updateEndpoint({ id: editingEndpoint.id, formData: data });
      setToastMsg({ type: 'success', text: `Updated ${data.name}` });
    } else {
      await createEndpoint(data);
      setToastMsg({ type: 'success', text: `Created ${data.name}` });
    }
  };

  const handleToggle = async (ep: MonitoredEndpoint) => {
    const nextState = !ep.is_enabled;
    await toggleEndpoint({ id: ep.id, isEnabled: nextState });
    setToastMsg({
      type: 'success',
      text: `${ep.name} is now ${nextState ? 'Active' : 'Paused'}`,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteEndpoint(deleteTarget.id);
    setToastMsg({ type: 'success', text: `Deleted ${deleteTarget.name}` });
    setDeleteTarget(null);
  };

  const handleManualTest = async (ep: MonitoredEndpoint) => {
    setTestingId(ep.id);
    try {
      const res = await triggerTestRun(ep);
      await refetch();
      let statusText = `Status ${res.status_code || (res.success ? 200 : 'Err')}`;
      if (res.error_category === 'SSRF_BLOCKED') {
        statusText = 'Blocked by SSRF filter';
      } else if (res.error_category === 'TIMEOUT') {
        statusText = 'Timeout exceeded';
      } else if (res.error_category === 'CONNECTION_REFUSED') {
        statusText = 'Connection refused / Unreachable';
      }
      setToastMsg({
        type: res.success ? 'success' : 'error',
        text: `Test run finished: ${statusText} in ${res.response_time_ms}ms. Schedule updated!`,
      });
    } catch (err: any) {
      setToastMsg({ type: 'error', text: err.message || 'Test execution failed' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.125rem' } }}
          >
            Monitored Endpoints
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Continuous background health checking powered by PostgreSQL pg_cron.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          size="medium"
          sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 42 }}
        >
          New Endpoint
        </Button>
      </Box>

      {/* Filter and Search Bar */}
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
            value={filterTab}
            onChange={(_, val) => handleFilterTabChange(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ minHeight: 40 }}
          >
            <Tab label={`All (${endpoints.length})`} value="all" sx={{ minHeight: 40, py: 0.5 }} />
            <Tab
              label={`Active (${endpoints.filter((e) => e.is_enabled).length})`}
              value="active"
              sx={{ minHeight: 40, py: 0.5 }}
            />
            <Tab
              label={`Paused (${endpoints.filter((e) => !e.is_enabled).length})`}
              value="paused"
              sx={{ minHeight: 40, py: 0.5 }}
            />
          </Tabs>

          <TextField
            size="small"
            placeholder="Search endpoints by name or URL..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#9CA3AF' }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', md: 320 } }}
          />
        </Box>
      </Card>

      {/* Content: Cards on Mobile / Table on Desktop */}
      <Card sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : filteredEndpoints.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
              No endpoints found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {search
                ? 'Try adjusting your search criteria.'
                : 'Configure your first HTTP GET health check to start background monitoring.'}
            </Typography>
            {!search && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                Configure First Endpoint
              </Button>
            )}
          </Box>
        ) : isMobile ? (
          /* Mobile Adaptive Cards */
          <Stack spacing={2} sx={{ p: 1.5 }}>
            {paginatedEndpoints.map((ep) => (
              <Card
                key={ep.id}
                sx={{
                  p: 2,
                  border: '1px solid #1F2937',
                  backgroundColor: '#111827',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700, color: '#F9FAFB', wordBreak: 'break-word', lineHeight: 1.3 }}
                    >
                      {ep.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: '"JetBrains Mono", monospace',
                        color: '#9CA3AF',
                        display: 'block',
                        wordBreak: 'break-all',
                        mt: 0.5,
                      }}
                    >
                      {ep.endpoint_url}
                    </Typography>
                  </Box>
                  <StatusChip type="endpoint-status" value={ep.is_enabled} />
                </Box>

                <Divider sx={{ my: 1.5, borderColor: '#1F2937' }} />

                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Cadence
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatInterval(ep.interval_seconds)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Next Execution
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: ep.is_enabled ? '#10B981' : '#9CA3AF', fontWeight: 600 }}
                    >
                      {ep.is_enabled ? formatRelativeTime(ep.next_run_at) : 'Paused'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Last Execution
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#E5E7EB' }}>
                      {formatRelativeTime(ep.last_run_at)} {ep.last_run_at ? `(${formatDateTime(ep.last_run_at)})` : ''}
                    </Typography>
                  </Grid>
                </Grid>

                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    pt: 1.5,
                    borderTop: '1px solid #1F2937',
                  }}
                >
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={testingId === ep.id}
                    startIcon={testingId === ep.id ? <CircularProgress size={16} color="inherit" /> : <FlashOnIcon />}
                    onClick={() => handleManualTest(ep)}
                    sx={{ flex: '1 1 auto', minHeight: 38 }}
                  >
                    {testingId === ep.id ? 'Running...' : 'Test Run'}
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={ep.is_enabled ? <PauseIcon /> : <PlayArrowIcon />}
                    onClick={() => handleToggle(ep)}
                    sx={{ flex: '1 1 auto', minHeight: 38, borderColor: '#374151' }}
                  >
                    {ep.is_enabled ? 'Pause' : 'Resume'}
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEdit(ep)}
                    sx={{ minHeight: 38, borderColor: '#374151' }}
                  >
                    Edit
                  </Button>

                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteTarget(ep)}
                    sx={{
                      minWidth: 38,
                      minHeight: 38,
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Card>
            ))}
          </Stack>
        ) : (
          /* Desktop Table View */
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Endpoint Name & URL</TableCell>
                  <TableCell>Cadence</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Execution</TableCell>
                  <TableCell>Next Execution</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEndpoints.map((ep) => (
                  <TableRow key={ep.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#F9FAFB' }}>
                        {ep.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: '"JetBrains Mono", monospace',
                          color: '#9CA3AF',
                          display: 'block',
                          maxWidth: 360,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ep.endpoint_url}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatInterval(ep.interval_seconds)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <StatusChip type="endpoint-status" value={ep.is_enabled} />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {formatRelativeTime(ep.last_run_at)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(ep.last_run_at)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={{ color: ep.is_enabled ? '#10B981' : '#9CA3AF' }}>
                        {ep.is_enabled ? formatRelativeTime(ep.next_run_at) : 'Paused'}
                      </Typography>
                      {ep.is_enabled && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(ep.next_run_at)}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="Test Run Now">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={testingId === ep.id}
                              onClick={() => handleManualTest(ep)}
                            >
                              {testingId === ep.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <FlashOnIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title={ep.is_enabled ? 'Pause Monitoring' : 'Resume Monitoring'}>
                          <IconButton
                            size="small"
                            color={ep.is_enabled ? 'warning' : 'success'}
                            onClick={() => handleToggle(ep)}
                          >
                            {ep.is_enabled ? (
                              <PauseIcon fontSize="small" />
                            ) : (
                              <PlayArrowIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit Configuration">
                          <IconButton size="small" onClick={() => handleOpenEdit(ep)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Endpoint">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(ep)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {filteredEndpoints.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredEndpoints.length}
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

      {/* Create / Edit Form Modal */}
      <EndpointFormModal
        open={modalOpen}
        endpoint={editingEndpoint}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This will permanently remove the endpoint configuration and all associated execution history records.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Toast */}
      <Snackbar
        open={Boolean(toastMsg)}
        autoHideDuration={4000}
        onClose={() => setToastMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toastMsg?.type || 'info'}
          onClose={() => setToastMsg(null)}
          sx={{ width: '100%' }}
        >
          {toastMsg?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
};
