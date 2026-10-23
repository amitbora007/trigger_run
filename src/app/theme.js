import { createTheme } from '@mui/material/styles';
export const appTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#10B981', // Electric Emerald
            light: '#34D399',
            dark: '#059669',
            contrastText: '#040711',
        },
        secondary: {
            main: '#6366F1', // Indigo / Cyber Violet
            light: '#818CF8',
            dark: '#4F46E5',
            contrastText: '#FFFFFF',
        },
        info: {
            main: '#06B6D4', // Cyber Cyan
            light: '#38BDF8',
            dark: '#0891B2',
            contrastText: '#040711',
        },
        success: {
            main: '#10B981',
            light: '#34D399',
            dark: '#047857',
            contrastText: '#040711',
        },
        warning: {
            main: '#F59E0B', // Telemetry Amber
            light: '#FBBF24',
            dark: '#B45309',
            contrastText: '#040711',
        },
        error: {
            main: '#EF4444', // Crimson Threat
            light: '#F87171',
            dark: '#B91C1C',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#040711', // Deep Obsidian Void
            paper: '#0A0F1D', // Obsidian Slate
        },
        text: {
            primary: '#F8FAFC',
            secondary: '#94A3B8',
        },
        divider: 'rgba(255, 255, 255, 0.08)',
    },
    typography: {
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h4: {
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: '#F8FAFC',
        },
        h5: {
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#F8FAFC',
        },
        h6: {
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: '#F8FAFC',
        },
        subtitle1: {
            fontWeight: 500,
            color: '#94A3B8',
        },
        subtitle2: {
            fontWeight: 600,
            color: '#CBD5E1',
        },
        body1: {
            color: '#F1F5F9',
        },
        body2: {
            color: '#94A3B8',
        },
        button: {
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: '0.015em',
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                ':root': {
                    colorScheme: 'dark',
                },
                body: {
                    backgroundColor: '#040711',
                    backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% -25%, rgba(16, 185, 129, 0.07), transparent 75%), radial-gradient(ellipse 70% 50% at 90% 110%, rgba(99, 102, 241, 0.05), transparent 70%)',
                    backgroundAttachment: 'fixed',
                    color: '#F8FAFC',
                    margin: 0,
                },
                '*::-webkit-scrollbar': {
                    width: '6px',
                    height: '6px',
                },
                '*::-webkit-scrollbar-track': {
                    background: 'transparent',
                },
                '*::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    borderRadius: '4px',
                },
                '*::-webkit-scrollbar-thumb:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.28)',
                },
                '::selection': {
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    color: '#FFFFFF',
                },
                '@keyframes vigilPulse': {
                    '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
                    '70%': { transform: 'scale(1)', boxShadow: '0 0 0 6px rgba(16, 185, 129, 0)' },
                    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)' },
                },
                '@keyframes vigilRadar': {
                    '0%': { opacity: 0.9, transform: 'scale(1)' },
                    '50%': { opacity: 0.3, transform: 'scale(1.35)' },
                    '100%': { opacity: 0.9, transform: 'scale(1)' },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    boxShadow: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        boxShadow: 'none',
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
                        boxShadow: '0 4px 18px rgba(16, 185, 129, 0.5)',
                    },
                },
                outlined: {
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(8px)',
                    '&:hover': {
                        borderColor: 'rgba(16, 185, 129, 0.5)',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: 'rgba(10, 15, 29, 0.75)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)',
                    transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease',
                    '&:hover': {
                        borderColor: 'rgba(16, 185, 129, 0.22)',
                        boxShadow: '0 8px 30px -4px rgba(0, 0, 0, 0.6), 0 0 20px -5px rgba(16, 185, 129, 0.15)',
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '12px 16px',
                },
                head: {
                    backgroundColor: 'rgba(6, 10, 20, 0.95)',
                    color: '#94A3B8',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                    borderRadius: 6,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#0A0F1D',
                    backgroundImage: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 16,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.12)',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(6, 10, 20, 0.6)',
                    borderRadius: 8,
                    '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.25)',
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: '#10B981',
                        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    minHeight: 40,
                    '& .MuiTabs-indicator': {
                        backgroundColor: '#10B981',
                        boxShadow: '0 0 10px #10B981',
                        height: 3,
                        borderRadius: '3px 3px 0 0',
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    minHeight: 40,
                    padding: '8px 16px',
                    color: '#94A3B8',
                    '&.Mui-selected': {
                        color: '#10B981',
                    },
                },
            },
        },
    },
});
