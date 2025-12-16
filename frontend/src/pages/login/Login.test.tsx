import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from "./index";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from "../../shared/store/useAuth";

// Mock useAuth
vi.mock('../../shared/store/useAuth', () => ({
  useAuth: vi.fn()
}));

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

// Mock useNavigate
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate
    };
});

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
        login: mockLogin
    });
  });

  it('renders login form elements', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByLabelText(/EMAIL ADDRESS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PASSWORD/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
  });

  it('submits login form with credentials', async () => {
    mockLogin.mockResolvedValue({}); // Success

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/EMAIL ADDRESS/i), { target: { value: 'test@zcr.ai' } });
    fireEvent.change(screen.getByLabelText(/PASSWORD/i), { target: { value: 'password123' } });
    
    const signInBtn = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
            email: 'test@zcr.ai',
            password: 'password123',
            mfaCode: undefined
        });
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('toggles to SSO mode', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    const ssoBtn = screen.getByRole('button', { name: /Sign in with SSO/i });
    fireEvent.click(ssoBtn);

    expect(screen.getByText('Single Sign-On')).toBeInTheDocument();
    expect(screen.getByLabelText(/ORGANIZATION ID/i)).toBeInTheDocument();
    
    // Check back button
    const backBtn = screen.getByText('Back to Standard Login');
    fireEvent.click(backBtn);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('handles MFA requirement', async () => {
    mockLogin.mockResolvedValue({ requireMFA: true });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText(/EMAIL ADDRESS/i), { target: { value: 'user@zcr.ai' } });
    fireEvent.change(screen.getByLabelText(/PASSWORD/i), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
        expect(screen.getByText('Security Check')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/AUTHENTICATOR CODE/i)).toBeInTheDocument();
  });
});
