import { useState } from 'react';
import { Card, CardBody, Input, Button, Link } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requireMFA, setRequireMFA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await login({ email, password, mfaCode: mfaCode || undefined });
      
      if (response?.requireMFA) {
        setRequireMFA(true);
        setIsLoading(false);
        return;
      }
      
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px] p-4">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            zcrAI Login
          </h1>

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {!requireMFA ? (
            <>
              <Input 
                label="Email" 
                placeholder="Enter your email" 
                value={email} 
                onValueChange={setEmail}
                className="mb-4"
              />
              <Input 
                label="Password" 
                type="password" 
                placeholder="Enter your password" 
                value={password}
                onValueChange={setPassword}
                className="mb-6"
              />
            </>
          ) : (
            <div className="mb-6">
              <p className="text-default-500 text-sm mb-4 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
              <Input 
                label="MFA Code" 
                placeholder="000000" 
                value={mfaCode}
                onValueChange={setMfaCode}
                maxLength={6}
                className="text-center"
              />
            </div>
          )}

          <Button 
            color="primary" 
            fullWidth 
            isLoading={isLoading}
            onPress={handleLogin}
          >
            {requireMFA ? 'Verify' : 'Login'}
          </Button>

          {requireMFA && (
            <Button
              variant="light"
              fullWidth
              className="mt-2"
              onPress={() => {
                setRequireMFA(false);
                setMfaCode('');
                setError('');
              }}
            >
              Back
            </Button>
          )}

          <div className="text-center mt-4 space-y-2">
            <Link href="/forgot-password" className="text-sm text-default-500 hover:text-primary block">
              Forgot Password?
            </Link>
            <p className="text-sm text-default-500">
              New here?{' '}
              <Link href="/register" className="text-primary">
                Register Tenant
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
