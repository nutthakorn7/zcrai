import { useState } from 'react';
import { Input, Button } from "@heroui/react";
import { api } from "@/shared/api";
import { Icon, IconSolid } from '../../shared/ui';
import { useNavigate } from "react-router-dom";
import ZcrAILogo from '../../assets/logo/zcrailogo.svg';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      setIsLoading(false);
      return;
    }

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      
      {/* Background Decor (Subtle Grid) */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#4A4D50 1px, transparent 1px)', 
          backgroundSize: '30px 30px' 
        }}
      />

      {/* Main Container */}
      <div className="w-full max-w-[420px] flex flex-col items-center z-10">
        
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative group">
            <div className="absolute inset-0 rounded-full blur-2xl bg-primary opacity-0 group-hover:opacity-40 transition-all duration-300" />
            <img 
              src={ZcrAILogo} 
              alt="zcrAI Logo" 
              className="w-20 h-20 group-hover:brightness-150 transition-all duration-300 animate-bounce relative z-10" 
              style={{
                animationDuration: '2s',
              }}
            />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight mt-2 text-foreground">
            Reset Password
          </h1>
          {!isSent && (
            <p className="text-foreground/60 text-sm mt-1 max-w-[300px]">
              Enter your email to receive instructions
            </p>
          )}
          <div className="mt-2 w-24 h-1 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
        </div>

        {/* Content */}
        <div className="w-full">
          {isSent ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                <IconSolid.CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Check your inbox</h3>
              <p className="text-foreground/60 text-center mb-8 text-sm leading-relaxed px-4">
                If an account exists for <span className="text-primary ">{email}</span>, 
                we've sent a password reset link.
              </p>
              
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-[50px] bg-primary hover:bg-primary/90 text-black font-bold font-display tracking-tight shadow-[0_0_20px_rgba(0,216,255,0.2)]"
              >
                Back to Login
              </Button>

              <button 
                onClick={() => { setIsSent(false); setEmail(''); }} 
                className="mt-6 text-xs text-foreground/60 hover:text-foreground/80 transition-colors"
              >
                Try different email
              </button>
            </div>
          ) : (
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} 
              className="flex flex-col gap-6 animate-fade-in"
            >
              
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-pulse">
                  <Icon.AlertCircle className="w-4 h-4 inline mr-2" />
                  {error}
                </div>
              )}

              <Input
                label="EMAIL ADDRESS"
                type="email"
                value={email}
                onValueChange={setEmail}
                placeholder="example@company.com"
                startContent={<Icon.Mail className="w-5 h-5 text-foreground/60" />}
                classNames={{
                  label: "text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]",
                  inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
                  input: " text-base placeholder:text-foreground/60"
                }}
              />

              <Button 
                type="submit" 
                isLoading={isLoading}
                className="h-[50px] bg-primary hover:bg-primary/90 text-black font-bold font-display tracking-tight shadow-[0_0_20px_rgba(0,216,255,0.2)]"
                spinner={<Icon.Refresh className="w-5 h-5 animate-spin" />}
              >
                Send Reset Link
              </Button>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2 text-foreground/60 hover:text-primary transition-colors text-sm group"
                >
                  <Icon.ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
