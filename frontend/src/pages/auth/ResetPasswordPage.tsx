import { useState } from 'react';
import { Card, CardBody, Input, Button, Link } from "@heroui/react";
import { api } from "../../shared/api/api";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      alert('Password reset successful! Please login with your new password.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[400px] p-4">
          <CardBody className="text-center">
            <h1 className="text-xl font-bold text-danger mb-4">Invalid Link</h1>
            <p className="mb-4">This password reset link is invalid or has expired.</p>
            <Button as={Link} href="/login" color="primary">Back to Login</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px] p-4">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Reset Password
          </h1>

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <Input 
            label="New Password" 
            type="password" 
            placeholder="Enter new password" 
            value={newPassword} 
            onValueChange={setNewPassword}
            className="mb-4"
          />

          <Input 
            label="Confirm Password" 
            type="password" 
            placeholder="Confirm new password" 
            value={confirmPassword} 
            onValueChange={setConfirmPassword}
            className="mb-6"
          />

          <Button 
            color="primary" 
            fullWidth 
            isLoading={isLoading}
            onPress={handleSubmit}
          >
            Reset Password
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
