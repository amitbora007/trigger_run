import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
const colorMap = {
    primary: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)', glow: 'rgba(16, 185, 129, 0.25)' },
    secondary: { bg: 'rgba(99, 102, 241, 0.1)', text: '#818CF8', border: 'rgba(99, 102, 241, 0.3)', glow: 'rgba(99, 102, 241, 0.25)' },
    success: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)', glow: 'rgba(16, 185, 129, 0.25)' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.25)' },
    error: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)', glow: 'rgba(239, 68, 68, 0.25)' },
};
export const MetricCard = ({ title, value, subtext, icon, colorVariant = 'primary', }) => {
    const colors = colorMap[colorVariant];
    return (<Card sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
                borderColor: colors.border,
                boxShadow: `0 8px 30px -4px rgba(0, 0, 0, 0.6), 0 0 20px -3px ${colors.glow}`,
            },
        }}>
      {/* Top Telemetry Neon Edge */}
      <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, transparent, ${colors.text}, transparent)`,
            opacity: 0.7,
        }}/>

      <CardContent sx={{ p: { xs: 2, sm: 2.25 }, '&:last-child': { pb: { xs: 2, sm: 2.25 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1.25, sm: 2 } }}>
          <Typography variant="body2" sx={{
            fontWeight: 700,
            fontSize: { xs: '0.78rem', sm: '0.85rem' },
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#94A3B8',
        }}>
            {title}
          </Typography>
          <Box sx={{
            p: { xs: 0.75, sm: 1 },
            borderRadius: '8px',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 10px ${colors.glow}`,
        }}>
            {React.cloneElement(icon, { sx: { fontSize: { xs: 18, sm: 20 } } })}
          </Box>
        </Box>

        <Typography variant="h4" sx={{
            fontWeight: 800,
            mb: 0.75,
            fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.15rem' },
            letterSpacing: '-0.03em',
            fontFamily: '"JetBrains Mono", monospace',
            fontFeatureSettings: '"tnum"',
            color: '#F8FAFC',
        }}>
          {value}
        </Typography>

        {subtext && (<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: colors.text,
                opacity: 0.8,
            }}/>
            <Typography variant="caption" sx={{
                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                color: '#94A3B8',
                fontWeight: 500,
            }}>
              {subtext}
            </Typography>
          </Box>)}
      </CardContent>
    </Card>);
};
