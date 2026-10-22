import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  TextField,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CodeIcon from '@mui/icons-material/Code';
import {
  useCronSchedule,
  CRON_PRESETS,
  getHumanCronLabel,
} from '../hooks/useCronSchedule';

interface CronScheduleModalProps {
  open: boolean;
  onClose: () => void;
}

export const CronScheduleModal: React.FC<CronScheduleModalProps> = ({ open, onClose }) => {
  const {
    schedule: currentSchedule,
    updateSchedule,
    isUpdating,
    isMigrationMissing,
  } = useCronSchedule();

  const [selectedSchedule, setSelectedSchedule] = useState<string>('* * * * *');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customCron, setCustomCron] = useState<string>('*/3 * * * *');
  const [copied, setCopied] = useState<boolean>(false);
  const [showSqlGuide, setShowSqlGuide] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync current schedule when opening modal
  useEffect(() => {
    if (open) {
      setSaveSuccess(false);
      setErrorMessage(null);
      const isPreset = CRON_PRESETS.some((p) => p.schedule === currentSchedule);
      if (isPreset) {
        setSelectedSchedule(currentSchedule);
        setIsCustom(false);
      } else {
        setIsCustom(true);
        setCustomCron(currentSchedule);
        setSelectedSchedule('custom');
      }
    }
  }, [open, currentSchedule]);

  const activeValue = isCustom ? customCron.trim() : selectedSchedule;

  const handleSelectPreset = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
      setSelectedSchedule('custom');
    } else {
      setIsCustom(false);
      setSelectedSchedule(value);
    }
    setErrorMessage(null);
  };

  const handleSave = async () => {
    setErrorMessage(null);
    const targetSchedule = isCustom ? customCron.trim() : selectedSchedule;

    // Validate 5-part cron syntax
    const parts = targetSchedule.split(/\s+/).filter(Boolean);
    if (parts.length !== 5) {
      setErrorMessage('Cron expression must have exactly 5 space-separated fields (minute hour day month day-of-week).');
      return;
    }

    try {
      await updateSchedule(targetSchedule);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update schedule in Supabase.');
    }
  };

  const copySqlSnippet = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const directSqlSnippet = `SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'vigilapi-minute-dispatcher'),
  schedule := '${activeValue}'
);`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <ScheduleIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Dispatcher Cron Cadence
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Controls the PostgreSQL <code>pg_cron</code> heartbeat (<code>vigilapi-minute-dispatcher</code>) that claims and executes due endpoint health checks.
        </Typography>

        {/* Current Active Status */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              CURRENT ACTIVE CADENCE
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {getHumanCronLabel(currentSchedule)}
            </Typography>
          </Box>
          <Chip
            label={currentSchedule}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontFamily: 'monospace', fontWeight: 600 }}
          />
        </Paper>

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Dispatcher cadence successfully updated to <strong>{activeValue}</strong>!
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {isMigrationMissing && (
          <Alert
            severity="info"
            icon={<InfoOutlinedIcon />}
            sx={{ mb: 2.5 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setShowSqlGuide((prev) => !prev)}
              >
                {showSqlGuide ? 'Hide SQL' : 'View SQL'}
              </Button>
            }
          >
            To enable 1-click updates from the browser, execute the RPC migration once in your Supabase SQL Editor.
          </Alert>
        )}

        {/* Preset Selection */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Select Desired Frequency:
        </Typography>

        <RadioGroup
          value={isCustom ? 'custom' : selectedSchedule}
          onChange={(e) => handleSelectPreset(e.target.value)}
        >
          {CRON_PRESETS.map((preset) => (
            <Paper
              key={preset.schedule}
              variant="outlined"
              onClick={() => handleSelectPreset(preset.schedule)}
              sx={{
                p: 1.5,
                mb: 1.25,
                cursor: 'pointer',
                borderRadius: 2,
                border: '1px solid',
                borderColor:
                  !isCustom && selectedSchedule === preset.schedule
                    ? 'primary.main'
                    : 'rgba(255, 255, 255, 0.08)',
                bgcolor:
                  !isCustom && selectedSchedule === preset.schedule
                    ? 'rgba(0, 230, 153, 0.06)'
                    : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <FormControlLabel
                  value={preset.schedule}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {preset.label}
                        </Typography>
                        {preset.tag && (
                          <Chip
                            label={preset.tag}
                            size="small"
                            color={preset.tag === 'Recommended' ? 'success' : 'default'}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                        {preset.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, width: '100%' }}
                />
                <Chip
                  label={preset.schedule}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    mt: 0.5,
                    display: { xs: 'none', sm: 'inline-flex' },
                  }}
                />
              </Box>
            </Paper>
          ))}

          {/* Custom Cron */}
          <Paper
            variant="outlined"
            onClick={() => handleSelectPreset('custom')}
            sx={{
              p: 1.5,
              cursor: 'pointer',
              borderRadius: 2,
              border: '1px solid',
              borderColor: isCustom ? 'primary.main' : 'rgba(255, 255, 255, 0.08)',
              bgcolor: isCustom ? 'rgba(0, 230, 153, 0.06)' : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <FormControlLabel
              value="custom"
              control={<Radio size="small" />}
              label={
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Custom Cron Expression
                </Typography>
              }
              sx={{ m: 0, width: '100%' }}
            />

            {isCustom && (
              <Box sx={{ mt: 1.5, pl: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cron Expression (5 Fields)"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="*/3 * * * *"
                  helperText="Format: minute hour day month day-of-week (e.g., */3 * * * *)"
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>
            )}
          </Paper>
        </RadioGroup>

        {/* Collapsible Direct SQL snippet */}
        <Box sx={{ mt: 2.5 }}>
          <Button
            size="small"
            startIcon={<CodeIcon />}
            onClick={() => setShowSqlGuide((prev) => !prev)}
            sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.8rem' }}
          >
            {showSqlGuide ? 'Hide Direct SQL Command' : 'Show Direct SQL Command (for Supabase SQL Editor)'}
          </Button>

          <Collapse in={showSqlGuide}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mt: 1,
                bgcolor: 'rgba(0, 0, 0, 0.35)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                position: 'relative',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  RUN IN SUPABASE SQL EDITOR:
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy SQL'}>
                  <IconButton
                    size="small"
                    onClick={() => copySqlSnippet(directSqlSnippet)}
                    sx={{ color: copied ? 'success.main' : 'text.secondary' }}
                  >
                    {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                component="pre"
                sx={{
                  m: 0,
                  p: 1.25,
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: 1,
                  color: 'primary.light',
                }}
              >
                {directSqlSnippet}
              </Typography>
            </Paper>
          </Collapse>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Button onClick={onClose} color="inherit" disabled={isUpdating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isUpdating}
          startIcon={isUpdating ? <CircularProgress size={16} color="inherit" /> : <ScheduleIcon />}
          sx={{ minWidth: 140 }}
        >
          {isUpdating ? 'Saving...' : 'Save Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
