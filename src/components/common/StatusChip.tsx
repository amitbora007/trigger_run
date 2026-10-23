import React from 'react';
import { Chip, ChipProps, Box } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';

interface StatusChipProps {
  type: 'endpoint-status' | 'http-status' | 'execution-result';
  value: string | number | boolean | null;
  size?: ChipProps['size'];
}

export const StatusChip: React.FC<StatusChipProps> = ({ type, value, size = 'small' }) => {
  if (type === 'endpoint-status') {
    const isEnabled = Boolean(value);
    return isEnabled ? (
      <Chip
        icon={
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              animation: 'vigilPulse 2s infinite',
              ml: 1,
              mr: -0.5,
            }}
          />
        }
        label="Active"
        size={size}
        sx={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#10B981',
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      />
    ) : (
      <Chip
        icon={<PauseCircleOutlineIcon sx={{ fontSize: 15 }} />}
        label="Paused"
        size={size}
        sx={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#F59E0B',
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      />
    );
  }

  if (type === 'execution-result') {
    const isSuccess = Boolean(value);
    return isSuccess ? (
      <Chip
        icon={<CheckCircleOutlineIcon sx={{ fontSize: 15 }} />}
        label="Passed"
        size={size}
        sx={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#10B981',
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.15)',
        }}
      />
    ) : (
      <Chip
        icon={<ErrorOutlineIcon sx={{ fontSize: 15 }} />}
        label="Failed"
        size={size}
        sx={{
          backgroundColor: 'rgba(239, 68, 68, 0.14)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#F87171',
          fontWeight: 700,
          fontSize: '0.72rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow: '0 0 10px rgba(239, 68, 68, 0.15)',
        }}
      />
    );
  }

  if (type === 'http-status') {
    const code = typeof value === 'number' ? value : null;
    if (!code) {
      return (
        <Chip
          label="No Response"
          size={size}
          sx={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#F87171',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        />
      );
    }
    if (code >= 200 && code < 300) {
      return (
        <Chip
          label={`${code} OK`}
          size={size}
          sx={{
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10B981',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        />
      );
    }
    if (code >= 300 && code < 400) {
      return (
        <Chip
          label={`${code} Redirect`}
          size={size}
          sx={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#F59E0B',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        />
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <Chip
          label={`${code} Client Error`}
          size={size}
          sx={{
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#FBBF24',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        />
      );
    }
    return (
      <Chip
        label={`${code} Server Error`}
        size={size}
        sx={{
          backgroundColor: 'rgba(239, 68, 68, 0.14)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#F87171',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.72rem',
          fontWeight: 700,
        }}
      />
    );
  }

  return null;
};

