import React, { useState } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, Alert } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
export const JsonViewer = ({ data, isTruncated = false, maxHeight = 350, }) => {
    const [copied, setCopied] = useState(false);
    if (!data) {
        return (<Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
        No response body returned
      </Typography>);
    }
    let formattedText = data;
    let isJson = false;
    try {
        const parsed = JSON.parse(data);
        formattedText = JSON.stringify(parsed, null, 2);
        isJson = true;
    }
    catch {
        // Keep raw string format
        formattedText = data;
        isJson = false;
    }
    const handleCopy = () => {
        navigator.clipboard.writeText(formattedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (<Box sx={{ position: 'relative' }}>
      {isTruncated && (<Alert severity="warning" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8rem' }}>
          Response body exceeded 32 KB threshold and has been safely truncated.
        </Alert>)}

      <Paper sx={{
            p: 2,
            backgroundColor: '#030712',
            border: '1px solid #1F2937',
            borderRadius: 2,
            maxHeight,
            overflow: 'auto',
            position: 'relative',
        }}>
        <Box sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
        }}>
          {isJson && (<Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.7rem' }}>
              JSON
            </Typography>)}
          <Tooltip title={copied ? 'Copied!' : 'Copy Body'}>
            <IconButton size="small" onClick={handleCopy} sx={{
            color: copied ? '#10B981' : '#9CA3AF',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
        }}>
              {copied ? <CheckIcon fontSize="small"/> : <ContentCopyIcon fontSize="small"/>}
            </IconButton>
          </Tooltip>
        </Box>

        <Box component="pre" sx={{
            m: 0,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.825rem',
            lineHeight: 1.5,
            color: '#E5E7EB',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
        }}>
          {formattedText}
        </Box>
      </Paper>
    </Box>);
};
