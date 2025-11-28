import { useState } from 'react';
import { Card, CardBody, Input, Button, Link } from "@heroui/react";
import { api } from "../../shared/api/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setIsSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px] p-4">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Forgot Password
          </h1>

          {isSent ? (
            <div className="text-center">
              <div className="text-success mb-4 text-5xl">✉️</div>
              <p className="mb-4 text-default-500">
                If an account exists for <b>{email}</b>, you will receive a password reset link shortly.
              </p>
              <Button as={Link} href="/login" color="primary" fullWidth>
                Back to Login
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <p className="text-default-500 mb-4 text-sm text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <Input 
                label="Email" 
                placeholder="Enter your email" 
                value={email} 
                onValueChange={setEmail}
                className="mb-6"
              />

              <Button 
                color="primary" 
                fullWidth 
                isLoading={isLoading}
                onPress={handleSubmit}
              >
                Send Reset Link
              </Button>

              <div className="text-center mt-4">
                <Link href="/login" className="text-sm text-primary">
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
