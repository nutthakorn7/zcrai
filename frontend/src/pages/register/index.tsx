import { useState } from 'react';
import { Input, Button, Checkbox } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";
import { Icon } from '../../shared/ui';
import ZcrAILogo from '../../assets/logo/zcrailogo.svg';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async () => {
    setIsLoading(true);
    setError('');

    if (!agreed) {
      setError('Please agree to the Terms of Service to continue.');
      setIsLoading(false);
      return;
    }

    try {
      await register({ email, password, tenantName });
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
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

      {/* Main Card Container */}
      <div className="w-full max-w-[420px] flex flex-col items-center z-10 my-10">
        
        {/* Header & Logo Section */}
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight mt-2 text-foreground">
              Create Account
            </h1>
            <p className="text-foreground/50 text-sm mt-1">
              Start securing your organization
            </p>
          </div>
          <div className="mt-2 w-24 h-1 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-centeranimate-pulse">
            <Icon.AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {/* Form Section */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleRegister(); }} 
          className="w-full flex flex-col gap-5 animate-fade-in"
        >
          
          {/* Organization Name */}
          <Input
            label="ORGANIZATION NAME"
            value={tenantName}
            onValueChange={setTenantName}
            startContent={<Icon.Building className="w-5 h-5 text-foreground/50" />}
            classNames={{
              label: "text-xs font-semibold text-foreground/50 uppercase tracking-wider ",
              inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
              input: " text-base"
            }}
          />

          {/* Email */}
          <Input
            label="EMAIL ADDRESS"
            type="email"
            value={email}
            onValueChange={setEmail}
            startContent={<Icon.Mail className="w-5 h-5 text-foreground/50" />}
            classNames={{
              label: "text-xs font-semibold text-foreground/50 uppercase tracking-wider ",
              inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
              input: " text-base"
            }}
          />

          {/* Password */}
          <Input
            label="PASSWORD"
            type={isVisible ? "text" : "password"}
            value={password}
            onValueChange={setPassword}
            startContent={<Icon.Lock className="w-5 h-5 text-foreground/50" />}
            endContent={
              <button 
                type="button" 
                onClick={() => setIsVisible(!isVisible)} 
                className="focus:outline-none text-foreground/50 hover:text-foreground/80"
              >
                {isVisible ? <Icon.EyeSlash className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
              </button>
            }
            classNames={{
              label: "text-xs font-semibold text-foreground/50 uppercase tracking-wider ",
              inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
              input: "text-base"
            }}
          />

          {/* Terms Checkbox */}
          <Checkbox 
            size="sm"
            isSelected={agreed}
            onValueChange={setAgreed}
            classNames={{
              label: "text-xs text-foreground/50 leading-tight"
            }}
          >
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
          </Checkbox>

          {/* Submit Button */}
          <Button 
            type="submit" 
            isLoading={isLoading}
            className="h-[50px] mt-2 bg-primary hover:bg-primary/90 text-background font-bold tracking-wide shadow-[0_0_20px_rgba(192,219,239,0.2)]"
            spinner={<Icon.Refresh className="w-5 h-5 animate-spin" />}
          >
            Sign Up
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-foreground/50">
          Already have an account?{" "}
          <a href="/login" className="text-primary font-bold hover:underline transition-all">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
