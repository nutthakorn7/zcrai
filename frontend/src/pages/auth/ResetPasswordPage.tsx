import { useState } from 'react';
import { Card, CardBody, Input, Button } from "@heroui/react";
import { api } from "@/shared/api";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Icon } from '../../shared/ui';
import ZcrAILogo from '../../assets/logo/zcrailogo.svg';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

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
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-[420px] bg-content1/50 border border-white/5 backdrop-blur-md">
          <CardBody className="text-center p-8">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-danger/20">
              <Icon.AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground mb-4">Invalid Link</h1>
            <p className="text-foreground/60 text-sm mb-8">This password reset link is invalid or has expired.</p>
            <Button 
                onClick={() => navigate('/login')} 
                color="primary"
                className="w-full h-[50px] bg-primary text-black font-bold font-display"
            >
                Back to Login
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#4A4D50 1px, transparent 1px)', 
          backgroundSize: '30px 30px' 
        }}
      />

      <div className="w-full max-w-[420px] z-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <img src={ZcrAILogo} alt="zcrAI Logo" className="w-20 h-20 mb-2" />
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
                Reset Password
            </h1>
            <p className="text-foreground/60 text-sm">Create a new secure password</p>
            <div className="mt-2 w-24 h-1 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
        </div>

        <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
          <CardBody className="p-8">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
              className="flex flex-col gap-6"
            >
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-pulse">
                  <Icon.AlertCircle className="w-4 h-4 inline mr-2" />
                  {error}
                </div>
              )}

              <Input 
                label="NEW PASSWORD" 
                type={isVisible ? "text" : "password"} 
                placeholder="Enter new password" 
                value={newPassword} 
                onValueChange={setNewPassword}
                startContent={<Icon.Lock className="w-5 h-5 text-foreground/60" />}
                endContent={
                    <button type="button" onClick={() => setIsVisible(!isVisible)} className="text-foreground/60">
                        {isVisible ? <Icon.EyeSlash className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                    </button>
                }
                classNames={{
                    label: "text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]",
                    inputWrapper: "bg-content1 border border-content4 h-[56px] hover:border-primary/50",
                    input: "text-base"
                }}
              />

              <Input 
                label="CONFIRM PASSWORD" 
                type={isVisible ? "text" : "password"} 
                placeholder="Confirm new password" 
                value={confirmPassword} 
                onValueChange={setConfirmPassword}
                startContent={<Icon.Lock className="w-5 h-5 text-foreground/60" />}
                classNames={{
                    label: "text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]",
                    inputWrapper: "bg-content1 border border-content4 h-[56px] hover:border-primary/50",
                    input: "text-base"
                }}
              />

              <Button 
                type="submit"
                color="primary" 
                className="w-full h-[50px] bg-primary hover:bg-primary/90 text-black font-bold font-display tracking-tight shadow-[0_0_20px_rgba(0,216,255,0.2)]"
                isLoading={isLoading}
              >
                Reset Password
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
