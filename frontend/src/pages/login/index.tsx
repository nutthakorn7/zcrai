import { useState } from 'react';
import { Input, Button, Checkbox } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";
import { Icon } from '../../shared/ui';
import ZcrAILogo from '../../assets/logo/zcrailogo.svg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [requireMFA, setRequireMFA] = useState(false);
  const [isSSO, setIsSSO] = useState(false); // Toggle SSO Mode
  const [ssoIdentifier, setSsoIdentifier] = useState(''); // Tenant ID or Email
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
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

  const handleSSOLogin = async () => {
      if (!ssoIdentifier) return;
      setIsLoading(true);
      setError('');
      try {
          // Ideally: Resolve tenant from email/identifier
          // For now: Assume Identifier IS Tenant ID
          const tenantId = ssoIdentifier;
          // Redirect to Backend SSO Login
          // Assuming backend running on port 8000 and proxy or full URL
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
          window.location.href = `${apiUrl}/auth/sso/login?tenantId=${tenantId}&provider=google`; 
      } catch (e) {
          setError('Failed to initiate SSO');
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
      <div className="w-full max-w-[420px] flex flex-col items-center z-10">
        
        {/* Header & Logo Section */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
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
          
          <div className="mt-2">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
              {requireMFA ? 'Security Check' : (isSSO ? 'Single Sign-On' : 'Welcome Back')}
            </h1>
            <p className="text-foreground/60 text-sm">
              {requireMFA 
                ? 'Enter the 6-digit code from your authenticator' 
                : (isSSO ? 'Enter your Organization ID to continue' : 'Sign in to your zecuraAI account')}
            </p>
          </div>
              <div className="mt-2 w-24 h-1 mx-auto bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center flex items-center justify-center gap-2 animate-pulse">
            <Icon.AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Form Section */}
        <form 
          onSubmit={(e) => { e.preventDefault(); isSSO ? handleSSOLogin() : handleLogin(); }} 
          className="w-full flex flex-col gap-6"
        >
          
          {!requireMFA ? (
             isSSO ? (
                /* SSO Form */
                <div className="space-y-5 animate-fade-in">
                    <Input
                        label="ORGANIZATION ID / TENANT ID"
                        value={ssoIdentifier}
                        onValueChange={setSsoIdentifier}
                        placeholder="e.g. acme-corp"
                        startContent={<Icon.Building className="w-5 h-5 text-foreground/60" />}
                        classNames={{
                        label: "text-xs font-semibold text-foreground/60 uppercase tracking-wider",
                        inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
                        input: "text-sm placeholder:text-foreground/60"
                        }}
                    />
                    <div className="flex flex-col gap-3 mt-4">
                        <Button 
                            type="submit" 
                            isLoading={isLoading}
                            className="h-[50px] bg-primary hover:bg-primary/90 text-background font-bold tracking-wide shadow-[0_0_20px_rgba(192,219,239,0.2)]"
                        >
                            Continue with SSOProvider
                        </Button>
                        <Button
                            variant="light"
                            type="button"
                            onClick={() => { setIsSSO(false); setError(''); }}
                            className="text-foreground/60 hover:text-foreground"
                        >
                            Back to Standard Login
                        </Button>
                    </div>
                </div>
             ) : (
                /* Standard Login Form */
                <div className="space-y-5 animate-fade-in">
                {/* Email */}
                <Input
                    label="EMAIL ADDRESS"
                    type="email"
                    value={email}
                    onValueChange={setEmail}
                    placeholder="example@company.com"
                    startContent={<Icon.Mail className="w-5 h-5 text-foreground/60" />}
                    classNames={{
                    label: "text-xs font-semibold text-foreground/60 uppercase tracking-wider",
                    inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
                    input: "text-sm placeholder:text-foreground/60"
                    }}
                />

                {/* Password */}
                <div className="space-y-2">
                    <Input
                    label="PASSWORD"
                    type={isVisible ? "text" : "password"}
                    value={password}
                    onValueChange={setPassword}
                    placeholder="Enter your password"
                    startContent={<Icon.Lock className="w-5 h-5 text-foreground/60" />}
                    endContent={
                        <button 
                        type="button" 
                        onClick={() => setIsVisible(!isVisible)} 
                        className="focus:outline-none text-foreground/60 hover:text-foreground/80"
                        >
                        {isVisible ? <Icon.EyeSlash className="w-5 h-5" /> : <Icon.Eye className="w-5 h-5" />}
                        </button>
                    }
                    classNames={{
                        label: "text-xs font-semibold text-foreground/60 uppercase tracking-wider",
                        inputWrapper: "bg-content1 border border-content4 hover:border-primary/50 data-[hover=true]:border-primary/50 group-data-[focus=true]:border-primary h-[56px]",
                        input: "text-sm placeholder:text-foreground/60"
                    }}
                    />
                    <div className="flex justify-end mt-1">
                    <a href="/forgot-password" className="text-primary hover:text-primary/80 text-xs transition-colors">
                        Forgot Password?
                    </a>
                    </div>
                </div>

                {/* Remember Me */}
                <Checkbox 
                    size="sm"
                    classNames={{
                    label: "text-xs text-foreground/60 "
                    }}
                >
                    Remember me on this device
                </Checkbox>
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-3 mt-4">
                    <Button 
                    type="submit" 
                    isLoading={isLoading}
                    className="h-[50px] bg-primary hover:bg-primary/90 text-background font-bold tracking-wide shadow-[0_0_20px_rgba(192,219,239,0.2)]"
                    spinner={<Icon.Refresh className="w-5 h-5 animate-spin" />}
                    >
                    Sign In
                    </Button>
                    
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-default-200"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-default-400">OR</span>
                        <div className="flex-grow border-t border-default-200"></div>
                    </div>

                    <Button
                        variant="bordered"
                        type="button"
                        onClick={() => { setIsSSO(true); setError(''); }}
                        className="h-[50px] border-default-200 hover:border-primary/50 text-foreground"
                        startContent={<Icon.Key className="w-5 h-5 text-primary" />}
                    >
                        Sign in with SSO
                    </Button>
                </div>
                </div>
             )
          ) : (
            /* MFA Form (Existing) */
            <div className="space-y-4 animate-fade-in">
              <Input
                autoFocus
                label="AUTHENTICATOR CODE"
                value={mfaCode}
                onValueChange={(value) => {
                  if (value.length <= 6) setMfaCode(value.replace(/\D/g, ''));
                }}
                placeholder="000 000"
                maxLength={6}
                startContent={<Icon.Key className="w-5 h-5 text-primary" />}
                classNames={{
                  label: "text-xs font-semibold text-foreground/60 uppercase tracking-wider",
                  inputWrapper: "bg-content1 border border-primary/50 h-[60px]",
                  input: "font-mono text-xl text-primary text-center tracking-widest"
                }}
              />
              <p className="text-center text-xs text-foreground/60">
                Open your authenticator app (Google Auth, Microsoft Auth) to view the code.
              </p>
              
               {/* Action Buttons for MFA */}
              <div className="flex flex-col gap-3 mt-4">
                <Button 
                type="submit" 
                isLoading={isLoading}
                className="h-[50px] bg-primary hover:bg-primary/90 text-background font-bold tracking-wide shadow-[0_0_20px_rgba(192,219,239,0.2)]"
                spinner={<Icon.Refresh className="w-5 h-5 animate-spin" />}
                >
                Verify Identity
                </Button>

                <Button
                    variant="light"
                    type="button"
                    onClick={() => {
                    setRequireMFA(false);
                    setMfaCode('');
                    setError('');
                    }}
                    className="text-foreground/60 hover:text-foreground"
                >
                    Back to Login
                </Button>
             </div>
            </div>
          )}
        </form>

        {/* Footer */}
        {!requireMFA && !isSSO && (
          <div className="mt-8 text-center text-sm text-foreground/60">
            Don't have an account?{" "}
            <a href="/register" className="text-primary font-bold hover:underline transition-all">
              Create Tenant
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
