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
            width: 38,
            height: 38,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.45)',
          }}
        >
          <FlashOnIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#F8FAFC',
            }}
          >
            VigilAPI
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#10B981',
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              mt: 0.25,
            }}
          >
            Telemetry Grid
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Navigation Links */}
      <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isSelected = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.75 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '10px',
                  py: 1.1,
                  px: 1.75,
                  transition: 'all 0.2s ease',
                  borderLeft: isSelected ? '3px solid #10B981' : '3px solid transparent',
                  '&.Mui-selected': {
                    background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.02) 100%)',
                    color: '#10B981',
                    boxShadow: 'inset 0 0 12px rgba(16, 185, 129, 0.08)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.04) 100%)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#10B981',
                      filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.5))',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isSelected ? '#10B981' : '#64748B' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.88rem',
                    fontWeight: isSelected ? 700 : 500,
                    letterSpacing: isSelected ? '0.01em' : 'normal',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Scheduler Status Card */}
      <Box sx={{ p: 2 }}>
        <Box
          onClick={() => setCronModalOpen(true)}
          sx={{
            p: 1.75,
            borderRadius: 2.5,
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            '&:hover': {
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
              transform: 'translateY(-1px)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  animation: 'vigilPulse 2s infinite',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: '#10B981',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.72rem',
                }}
              >
                pg_cron Cadence
              </Typography>
            </Box>
            <Chip
              label={cronCadenceLabel}
              size="small"
              variant="outlined"
              color="success"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                borderColor: 'rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: '#94A3B8',
              display: 'block',
              fontSize: '0.75rem',
              lineHeight: 1.3,
            }}
          >
            Click to view or reschedule dispatcher heartbeat.
          </Typography>
        </Box>
      </Box>

      {/* User Session Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, textOverflow: 'ellipsis', color: '#F1F5F9' }}>
          {user?.user_metadata?.full_name || 'Authenticated Operator'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {user?.email || 'operator@vigilapi.internal'}
        </Typography>

        <Button
          variant="outlined"
          color="inherit"
          size="small"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => signOut()}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.12)',
            color: '#94A3B8',
            fontSize: '0.8rem',
            '&:hover': {
              borderColor: 'rgba(239, 68, 68, 0.5)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#EF4444',
            },
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'transparent' }}>
      {/* Top Bar on Mobile */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          backgroundColor: 'rgba(6, 10, 20, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1.5, sm: 3 }, minHeight: { xs: 56, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: { xs: 1, sm: 2 }, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.05rem', sm: '1.25rem' },
                  letterSpacing: '-0.02em',
                  maxWidth: { xs: '180px', sm: 'none' },
                }}
              >
                {NAV_ITEMS.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {isDemoMode && (
              <Chip
                label={isMobile ? 'Demo' : 'Sandbox Demo'}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderColor: 'rgba(99, 102, 241, 0.5)',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: '#818CF8',
                }}
              />
            )}
            <Tooltip title="Click to view or reschedule pg_cron dispatcher cadence">
              <Box
                onClick={() => setCronModalOpen(true)}
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    animation: 'vigilPulse 2s infinite',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: '#10B981',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  pg_cron: {cronCadenceLabel}
                </Typography>
              </Box>
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
              backgroundColor: 'rgba(6, 10, 20, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
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
              backgroundColor: 'rgba(6, 10, 20, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
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
          backgroundColor: 'transparent',
        }}
      >
        <Outlet />
      </Box>

      <CronScheduleModal open={cronModalOpen} onClose={() => setCronModalOpen(false)} />
    </Box>
  );
};

