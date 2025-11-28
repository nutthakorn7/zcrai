import { useState } from 'react';
import { Card, CardBody, Input, Button, Link } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async () => {
    setIsLoading(true);
    setError('');
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px] p-4">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            zcrAI Register
          </h1>

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <Input 
            label="Organization Name" 
            placeholder="Company Name" 
            value={tenantName} 
            onValueChange={setTenantName}
            className="mb-4"
          />
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
            placeholder="Create a password" 
            value={password}
            onValueChange={setPassword}
            className="mb-6"
          />

          <Button 
            color="primary" 
            fullWidth 
            isLoading={isLoading}
            onPress={handleRegister}
          >
            Register
          </Button>

          <div className="text-center mt-4">
            <p className="text-sm text-default-500">
              Already have an account?{' '}
              <Link href="/login" className="text-primary">
                Login
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
