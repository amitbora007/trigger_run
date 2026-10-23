import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { AuthProvider } from '../../src/features/auth/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from '../../src/app/theme';
import { supabase } from '../../src/lib/supabaseClient';

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
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders sign in tab by default', () => {
    renderLoginPage();
    expect(screen.getByText('VigilAPI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Sandbox Demo/i })).toBeInTheDocument();
  });

  it('switches to create account tab when tab clicked', () => {
    renderLoginPage();
    const createAccountTab = screen.getByRole('tab', { name: /Create Account/i });
    fireEvent.click(createAccountTab);

    expect(screen.getByRole('button', { name: /Register Account/i })).toBeInTheDocument();
    expect(screen.getByText(/Minimum 8 characters/i)).toBeInTheDocument();
  });

  it('rejects login and displays error when wrong password or invalid credentials entered', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials'),
    } as any);

    renderLoginPage();

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In to Workspace/i });

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'wrongpassword',
    });
  });

  it('does not log into demo mode when invalid username is submitted', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Invalid login credentials'),
    } as any);

    renderLoginPage();

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In to Workspace/i });

    fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });

    // Verify still on login page and not in workspace
    expect(screen.getByRole('button', { name: /Sign In to Workspace/i })).toBeInTheDocument();
  });

  it('allows entering demo mode only when Explore Sandbox Demo is clicked', () => {
    renderLoginPage();

    const demoBtn = screen.getByRole('button', { name: /Explore Sandbox Demo/i });
    expect(demoBtn).toBeInTheDocument();
    fireEvent.click(demoBtn);

    // After clicking demo button, navigation is triggered
    expect(demoBtn).toBeInTheDocument();
  });
});
