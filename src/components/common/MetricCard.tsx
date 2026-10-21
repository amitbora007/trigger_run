import React from 'react';
import { Card, CardContent, Typography, Box, SvgIconProps } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactElement<SvgIconProps>;
  colorVariant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const colorMap = {
  primary: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' },
  secondary: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366F1' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' },
  error: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  icon,
  colorVariant = 'primary',
}) => {
  const colors = colorMap[colorVariant];

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2 }, '&:last-child': { pb: { xs: 1.75, sm: 2 } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1, sm: 2 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            {title}
          </Typography>
          <Box
            sx={{
              p: { xs: 0.75, sm: 1 },
              borderRadius: '8px',
              backgroundColor: colors.bg,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: { xs: 18, sm: 20 } } })}
          </Box>
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 0.5,
            fontSize: { xs: '1.45rem', sm: '1.75rem', md: '2.125rem' },
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </Typography>

        {subtext && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
            {subtext}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
