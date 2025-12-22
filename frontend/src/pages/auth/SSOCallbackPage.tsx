import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/store/useAuth';

export const SSOCallbackPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // const { login } = useAuth(); // Not needed if we manually set token
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const token = searchParams.get('token');
        if (token) {
            // Store token
            localStorage.setItem('token', token);
            // Update auth state (trigger re-verification or just set state)
            // Ideally useAuth().setToken(token) or similar
            // Force reload or navigate
            navigate('/dashboard');
            window.location.reload(); // To ensure auth state is fresh
        } else {
            navigate('/login?error=sso_failed');
        }
    }, [searchParams, navigate]);

    return (
        <div className="flex h-screen items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Completing login...</span>
        </div>
    );
};

export default SSOCallbackPage;
