import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Tab,
  Tabs,
  Stack,
  Divider,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import { useAuth } from './AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, enableDemoMode } = useAuth();

  const [tabIndex, setTabIndex] = useState(0); // 0 = signin, 1 = signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tabIndex === 0) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSuccessMsg('Account created successfully! You can now sign in.');
        setTabIndex(0);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        setError(
          'Supabase free-tier email rate limit reached (max 3-4 emails/hour). To bypass: toggle off "Confirm email" in Supabase Auth Settings, or click "Explore Sandbox Demo" below for instant access.'
        );
      } else {
        setError(msg || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    enableDemoMode();
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient radial lights */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      <Card
        sx={{
          maxWidth: 460,
          width: '100%',
          p: { xs: 2, sm: 2.5 },
          backgroundColor: 'rgba(10, 15, 29, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.12)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 3 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
              }}
            >
              <FlashOnIcon sx={{ color: '#fff', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
                VigilAPI
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#10B981',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'block',
                }}
              >
                Autonomous Telemetry Platform
              </Typography>
            </Box>
          </Box>

          <Tabs
            value={tabIndex}
            onChange={(_, val) => {
              setTabIndex(val);
              setError(null);
            }}
            variant="fullWidth"
            sx={{ mb: 3 }}
          >
            <Tab label="Sign In" />
            <Tab label="Create Account" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2, backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              {error}
            </Alert>
          )}

          {successMsg && (
            <Alert severity="success" sx={{ mb: 2, backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              {successMsg}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Work Email"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@company.com"
                autoComplete="email"
              />

              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                helperText={tabIndex === 1 ? 'Minimum 8 characters' : undefined}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                startIcon={<LockOutlinedIcon />}
                sx={{ minHeight: 46 }}
              >
                {loading
                  ? 'Processing...'
                  : tabIndex === 0
                  ? 'Sign In to Workspace'
                  : 'Register Account'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, letterSpacing: '0.08em' }}>
              QUICK EVALUATION
            </Typography>
          </Divider>

          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            onClick={handleDemoSignIn}
            startIcon={<FlashOnIcon sx={{ color: '#818CF8' }} />}
            sx={{
              minHeight: 44,
              borderColor: 'rgba(99, 102, 241, 0.4)',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              color: '#C7D2FE',
              '&:hover': {
                borderColor: '#818CF8',
                backgroundColor: 'rgba(99, 102, 241, 0.16)',
                boxShadow: '0 0 16px rgba(99, 102, 241, 0.3)',
              },
            }}
          >
            Explore Sandbox Demo (Instant 1-Click Access)
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};
