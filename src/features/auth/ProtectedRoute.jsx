import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext';
export const ProtectedRoute = () => {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return (<Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                backgroundColor: '#0B0F19',
            }}>
        <CircularProgress color="primary"/>
      </Box>);
    }
    if (!user) {
        return <Navigate to="/login" replace/>;
    }
    return <Outlet />;
};
