import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { AuthProvider } from '../../src/features/auth/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '../../src/app/theme';

function renderLoginPage() {
  return render(
    <ThemeProvider theme={appTheme}>
      <AuthProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe('LoginPage Component', () => {
  it('renders sign in tab by default', () => {
    renderLoginPage();
    expect(screen.getByText('VigilAPI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Workspace/i })).toBeInTheDocument();
  });

  it('switches to create account tab when tab clicked', () => {
    renderLoginPage();
    const createAccountTab = screen.getByRole('tab', { name: /Create Account/i });
    fireEvent.click(createAccountTab);

    expect(screen.getByRole('button', { name: /Register Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Minimum 8 characters/i)).toBeInTheDocument();
  });
});
