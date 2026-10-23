import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Stack,
  FormControlLabel,
  Switch,
  Slider,
  IconButton,
  Alert,
  Chip,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SecurityIcon from '@mui/icons-material/Security';
import { validateClientUrl } from '@/lib/ssrfValidator';
import type { MonitoredEndpoint, EndpointFormData } from '@/types';

const INTERVAL_PRESETS = [
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '15m', value: 900 },
  { label: '30m', value: 1800 },
  { label: '1h', value: 3600 },
  { label: '6h', value: 21600 },
  { label: '12h', value: 43200 },
  { label: '24h', value: 86400 },
];

const endpointSchema = z.object({
  name: z.string().min(1, 'Name is required').max(128, 'Maximum 128 characters'),
  endpoint_url: z
    .string()
    .min(1, 'Target URL is required')
    .refine((url) => validateClientUrl(url).isValid, {
      message: 'Invalid or restricted URL (SSRF protected: private IPs/localhost blocked)',
    }),
  interval_seconds: z
    .number()
    .min(300, 'Minimum monitoring interval is 5 minutes (300 seconds)'),
  request_timeout_ms: z
    .number()
    .min(1000, 'Minimum timeout is 1000ms')
    .max(30000, 'Maximum timeout is 30,000ms'),
  query_params: z.array(z.object({ key: z.string(), value: z.string() })),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  is_enabled: z.boolean(),
  notify_on_failure: z.boolean(),
  notification_email: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: 'Please enter a valid email address' }
    ),
});

interface EndpointFormModalProps {
  open: boolean;
  endpoint?: MonitoredEndpoint | null;
  onClose: () => void;
  onSubmit: (data: EndpointFormData) => Promise<any>;
}

export const EndpointFormModal: React.FC<EndpointFormModalProps> = ({
  open,
  endpoint,
  onClose,
  onSubmit,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabIndex, setTabIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EndpointFormData>({
    resolver: zodResolver(endpointSchema),
    defaultValues: {
      name: '',
      endpoint_url: '',
      interval_seconds: 300,
      request_timeout_ms: 10000,
      query_params: [],
      headers: [],
      is_enabled: true,
      notify_on_failure: true,
      notification_email: '',
    },
  });

  const {
    fields: queryParamFields,
    append: appendQueryParam,
    remove: removeQueryParam,
  } = useFieldArray({ control, name: 'query_params' });

  const {
    fields: headerFields,
    append: appendHeader,
    remove: removeHeader,
  } = useFieldArray({ control, name: 'headers' });

  useEffect(() => {
    if (endpoint) {
      const qpArray = Object.entries(endpoint.query_params || {}).map(([key, value]) => ({
        key,
        value,
      }));
      const hdrArray = Object.entries(endpoint.headers || {}).map(([key, value]) => ({
        key,
        value,
      }));
      reset({
        name: endpoint.name,
        endpoint_url: endpoint.endpoint_url,
        interval_seconds: endpoint.interval_seconds,
        request_timeout_ms: endpoint.request_timeout_ms,
        query_params: qpArray,
        headers: hdrArray,
        is_enabled: endpoint.is_enabled,
        notify_on_failure: endpoint.notify_on_failure ?? true,
        notification_email: endpoint.notification_email || '',
      });
    } else {
      reset({
        name: '',
        endpoint_url: '',
        interval_seconds: 300,
        request_timeout_ms: 10000,
        query_params: [],
        headers: [],
        is_enabled: true,
        notify_on_failure: true,
        notification_email: '',
      });
    }
    setSubmitError(null);
    setTabIndex(0);
  }, [endpoint, open, reset]);

  const currentInterval = watch('interval_seconds');
  const watchedUrl = watch('endpoint_url');
  const ssrfCheck = validateClientUrl(watchedUrl);

  const handleFormSubmit = async (data: EndpointFormData) => {
    setSubmitError(null);
    try {
      await onSubmit(data);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save endpoint');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          pb: 1,
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 2.5 },
          fontWeight: 700,
          fontSize: { xs: '1.15rem', sm: '1.25rem' },
        }}
      >
        {endpoint ? 'Edit Monitored Endpoint' : 'Create New Monitored Endpoint'}
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 1.5, sm: 3 } }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Configuration" />
          <Tab label="Headers & Query Params" />
          <Tab label="Alerts & Notifications" />
        </Tabs>
      </Box>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent sx={{ pt: 2.5, px: { xs: 2, sm: 3 } }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {tabIndex === 0 && (
            <Stack spacing={3}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Endpoint Name"
                    placeholder="e.g. Production Payment Gateway"
                    fullWidth
                    required
                    error={Boolean(errors.name)}
                    helperText={errors.name?.message}
                  />
                )}
              />

              <Controller
                name="endpoint_url"
                control={control}
                render={({ field }) => (
                  <Box>
                    <TextField
                      {...field}
                      label="Target HTTP GET URL"
                      placeholder="https://api.example.com/health"
                      fullWidth
                      required
                      error={Boolean(errors.endpoint_url)}
                      helperText={
                        errors.endpoint_url?.message ||
                        (!ssrfCheck.isValid && watchedUrl ? ssrfCheck.message : 'HTTP GET health check endpoint')
                      }
                      InputProps={{
                        endAdornment: (
                          <SecurityIcon
                            sx={{
                              color: ssrfCheck.isValid && watchedUrl ? '#10B981' : '#6B7280',
                              fontSize: 20,
                            }}
                          />
                        ),
                      }}
                    />
                  </Box>
                )}
              />

              {/* Interval Presets */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Check Cadence (Minimum 5 Minutes)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {INTERVAL_PRESETS.map((preset) => (
                    <Chip
                      key={preset.value}
                      label={preset.label}
                      clickable
                      color={currentInterval === preset.value ? 'primary' : 'default'}
                      variant={currentInterval === preset.value ? 'filled' : 'outlined'}
                      onClick={() => setValue('interval_seconds', preset.value)}
                    />
                  ))}
                </Box>
                <Controller
                  name="interval_seconds"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="number"
                      label="Custom Interval (Seconds)"
                      size="small"
                      fullWidth
                      error={Boolean(errors.interval_seconds)}
                      helperText={errors.interval_seconds?.message || 'Validated server-side and client-side (>= 300s)'}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 300)}
                    />
                  )}
                />
              </Box>

              {/* Request Timeout Slider */}
              <Controller
                name="request_timeout_ms"
                control={control}
                render={({ field }) => (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Request Timeout
                      </Typography>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                        {field.value / 1000}s ({field.value} ms)
                      </Typography>
                    </Box>
                    <Slider
                      value={field.value}
                      min={1000}
                      max={30000}
                      step={1000}
                      onChange={(_, val) => field.onChange(val as number)}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v / 1000}s`}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Edge Function will abort connection if request exceeds this limit.
                    </Typography>
                  </Box>
                )}
              />

              <Controller
                name="is_enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Enable Monitoring Immediately
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Next execution will be scheduled at NOW()
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </Stack>
          )}

          {tabIndex === 1 && (
            <Stack spacing={3}>
              {/* Custom Headers */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Custom Request Headers
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => appendHeader({ key: '', value: '' })}
                  >
                    Add Header
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Sensitive keys (e.g. Auth, Token, Secret) will be automatically masked in output logs.
                </Typography>

                {headerFields.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No custom headers configured. Default User-Agent is provided.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {headerFields.map((field, index) => (
                      <Box
                        key={field.id}
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1,
                          p: { xs: 1.5, sm: 0 },
                          backgroundColor: { xs: '#1F2937', sm: 'transparent' },
                          borderRadius: 1.5,
                        }}
                      >
                        <TextField
                          placeholder="Header Name (e.g. X-Api-Key)"
                          size="small"
                          sx={{ flex: 1 }}
                          {...control.register(`headers.${index}.key` as const)}
                        />
                        <TextField
                          placeholder="Value"
                          size="small"
                          sx={{ flex: 1 }}
                          {...control.register(`headers.${index}.value` as const)}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeHeader(index)}
                          sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Query Parameters */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Optional Query Parameters
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => appendQueryParam({ key: '', value: '' })}
                  >
                    Add Parameter
                  </Button>
                </Box>

                {queryParamFields.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No query parameters configured.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {queryParamFields.map((field, index) => (
                      <Box
                        key={field.id}
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' },
                          gap: 1,
                          p: { xs: 1.5, sm: 0 },
                          backgroundColor: { xs: '#1F2937', sm: 'transparent' },
                          borderRadius: 1.5,
                        }}
                      >
                        <TextField
                          placeholder="Key"
                          size="small"
                          sx={{ flex: 1 }}
                          {...control.register(`query_params.${index}.key` as const)}
                        />
                        <TextField
                          placeholder="Value"
                          size="small"
                          sx={{ flex: 1 }}
                          {...control.register(`query_params.${index}.value` as const)}
                        />
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeQueryParam(index)}
                          sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}

          {tabIndex === 2 && (
            <Stack spacing={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid #1F2937',
                  backgroundColor: 'rgba(16, 185, 129, 0.04)',
                }}
              >
                <Controller
                  name="notify_on_failure"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch checked={field.value} onChange={field.onChange} color="primary" />}
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Send Email Alert on Failure
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Dispatches an immediate incident email via Resend when a scheduled health check fails or times out.
                          </Typography>
                        </Box>
                      }
                    />
                  )}
                />
              </Box>

              <Controller
                name="notification_email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Alert Recipient Email"
                    placeholder="e.g. alerts@company.com (leave blank for account email)"
                    fullWidth
                    error={Boolean(errors.notification_email)}
                    helperText={
                      errors.notification_email?.message ||
                      'Optional: Specify a custom team or ops email. If left blank, alerts are sent to your registered account email.'
                    }
                  />
                )}
              />

              <Alert severity="info" sx={{ fontSize: '0.8125rem' }}>
                <strong>Alert Cooldown Protection:</strong> To prevent alert storms during extended outages, VigilAPI enforces a 15-minute cooldown between incident emails for the same endpoint.
              </Alert>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, gap: 1 }}>
          <Button
            onClick={onClose}
            color="inherit"
            disabled={isSubmitting}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            sx={{ width: { xs: '100%', sm: 'auto' }, minHeight: 40 }}
          >
            {isSubmitting ? 'Saving...' : endpoint ? 'Update Endpoint' : 'Save & Activate'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
