import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';

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
        icon={<PlayCircleOutlineIcon />}
        label="Active"
        color="success"
        variant="outlined"
        size={size}
      />
    ) : (
      <Chip
        icon={<PauseCircleOutlineIcon />}
        label="Paused"
        color="warning"
        variant="outlined"
        size={size}
      />
    );
  }

  if (type === 'execution-result') {
    const isSuccess = Boolean(value);
    return isSuccess ? (
      <Chip
        icon={<CheckCircleOutlineIcon />}
        label="Passed"
        color="success"
        size={size}
      />
    ) : (
      <Chip
        icon={<ErrorOutlineIcon />}
        label="Failed"
        color="error"
        size={size}
      />
    );
  }

  if (type === 'http-status') {
    const code = typeof value === 'number' ? value : null;
    if (!code) {
      return <Chip label="No Response" color="error" variant="outlined" size={size} />;
    }
    if (code >= 200 && code < 300) {
      return <Chip label={`${code} OK`} color="success" size={size} />;
    }
    if (code >= 300 && code < 400) {
      return <Chip label={`${code} Redirect`} color="warning" size={size} />;
    }
    if (code >= 400 && code < 500) {
      return <Chip label={`${code} Client Error`} color="error" variant="outlined" size={size} />;
    }
    return <Chip label={`${code} Server Error`} color="error" size={size} />;
  }

  return null;
};
