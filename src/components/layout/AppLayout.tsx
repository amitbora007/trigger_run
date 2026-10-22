import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SensorsIcon from '@mui/icons-material/Sensors';
import HistoryIcon from '@mui/icons-material/History';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LogoutIcon from '@mui/icons-material/Logout';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '@/features/auth/AuthContext';
import { CronScheduleModal } from '@/features/dashboard/components/CronScheduleModal';
import { useCronSchedule } from '@/features/dashboard/hooks/useCronSchedule';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { text: 'Overview', path: '/', icon: <DashboardIcon /> },
  { text: 'Endpoints', path: '/endpoints', icon: <SensorsIcon /> },
  { text: 'Execution History', path: '/executions', icon: <HistoryIcon /> },
  { text: 'Analytics', path: '/analytics', icon: <AssessmentIcon /> },
];

export const AppLayout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isDemoMode } = useAuth();
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const { humanLabel: cronCadenceLabel } = useCronSchedule();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand Header */}
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FlashOnIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            VigilAPI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Cloud API Watchdog
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#1F2937' }} />

      {/* Navigation Links */}
      <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isSelected = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '8px',
                  py: 1,
                  px: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                    '&:hover': {
                      backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#10B981',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? '#10B981' : '#9CA3AF' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#1F2937' }} />

      {/* Scheduler Status Card */}
      <Box sx={{ p: 2 }}>
        <Box
          onClick={() => setCronModalOpen(true)}
          sx={{
            p: 1.5,
            borderRadius: 2,
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': {
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#10B981', fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>
                pg_cron Cadence
              </Typography>
            </Box>
            <Chip
              label={cronCadenceLabel}
              size="small"
              variant="outlined"
              color="success"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', fontSize: '0.75rem' }}>
            Click to view or reschedule dispatcher heartbeat.
          </Typography>
        </Box>
      </Box>

      {/* User Session Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid #1F2937' }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, textOverflow: 'ellipsis' }}>
          {user?.user_metadata?.full_name || 'Authenticated User'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {user?.email || 'user@example.com'}
        </Typography>

        <Button
          variant="outlined"
          color="inherit"
          size="small"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => signOut()}
          sx={{ borderColor: '#374151', color: '#9CA3AF' }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0B0F19' }}>
      {/* Top Bar on Mobile */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1F2937',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: { xs: 1, sm: 2 }, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.05rem', sm: '1.25rem' },
                maxWidth: { xs: '180px', sm: 'none' },
              }}
            >
              {NAV_ITEMS.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isDemoMode && (
              <Chip
                label="Demo"
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ height: 24, fontSize: '0.75rem' }}
              />
            )}
            <Tooltip title="Click to view or reschedule pg_cron dispatcher cadence">
              <Chip
                label={`pg_cron: ${cronCadenceLabel}`}
                size="small"
                color="success"
                variant="filled"
                onClick={() => setCronModalOpen(true)}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, cursor: 'pointer' }}
              />
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              backgroundColor: '#111827',
              borderRight: '1px solid #1F2937',
            },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Permanent Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              backgroundColor: '#111827',
              borderRight: '1px solid #1F2937',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2.5, md: 4 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: { xs: '56px', sm: '64px' },
          minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
          backgroundColor: '#0B0F19',
        }}
      >
        <Outlet />
      </Box>

      <CronScheduleModal open={cronModalOpen} onClose={() => setCronModalOpen(false)} />
    </Box>
  );
};
