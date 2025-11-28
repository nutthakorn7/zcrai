import { useState } from 'react';
import { Card, CardBody, Input, Button, Image } from "@heroui/react";
import { api } from "../../shared/api/api";
import { useNavigate } from "react-router-dom";

export default function MFASetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/mfa/setup');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/mfa/verify', {
        secret,
        code: verifyCode,
        backupCodes,
      });
      alert('MFA enabled successfully!');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md p-4">
        <CardBody>
          <h1 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
            Setup MFA
          </h1>

          {error && (
            <div className="bg-danger/20 text-danger p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {step === 'setup' && (
            <div className="text-center">
              <p className="text-default-500 mb-6">
                Enable Two-Factor Authentication to secure your account.
              </p>
              <Button
                color="primary"
                fullWidth
                isLoading={isLoading}
                onPress={handleSetup}
              >
                Setup MFA
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Image
                  src={qrCode}
                  alt="MFA QR Code"
                  width={200}
                  height={200}
                  className="border rounded-lg"
                />
              </div>

              <div className="bg-default-100 p-3 rounded-lg">
                <p className="text-xs text-default-500 mb-1">Manual entry key:</p>
                <code className="text-sm break-all">{secret}</code>
              </div>

              <div className="bg-warning/20 p-3 rounded-lg">
                <p className="text-xs text-warning mb-2 font-bold">
                  ⚠️ Save these backup codes (shown once):
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-xs bg-default-200 p-1 rounded">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <Input
                label="Verification Code"
                placeholder="Enter 6-digit code from app"
                value={verifyCode}
                onValueChange={setVerifyCode}
                maxLength={6}
              />

              <Button
                color="primary"
                fullWidth
                isLoading={isLoading}
                onPress={handleVerify}
                isDisabled={verifyCode.length !== 6}
              >
                Verify & Enable MFA
              </Button>

              <Button
                variant="light"
                fullWidth
                onPress={() => navigate('/')}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
