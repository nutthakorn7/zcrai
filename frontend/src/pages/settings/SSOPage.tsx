import { useState, useEffect } from "react";
import { Button, Input, Select, SelectItem, Card, CardBody, Switch, Divider } from "@heroui/react";
import { Icon } from "../../shared/ui";

import { api } from "../../shared/api/api";

// Example Providers
const PROVIDERS = [
  { key: 'google', label: 'Google Workspace' },
  { key: 'okta', label: 'Okta' },
  { key: 'azure-ad', label: 'Azure AD' },
  { key: 'generic-oidc', label: 'Generic OIDC' },
];

export default function SSOPage() {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('google');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [issuer, setIssuer] = useState('');
  const [authEndpoint, setAuthEndpoint] = useState('');
  const [tokenEndpoint, setTokenEndpoint] = useState('');
  const [userInfoEndpoint, setUserInfoEndpoint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load Config
  useEffect(() => {
    const loadConfig = async () => {
        try {
            const { data } = await api.get('/auth/sso/config');
            if (data) {
                setProvider(data.provider || 'google');
                setClientId(data.clientId || '');
                setClientSecret(data.clientSecret || '');
                setIssuer(data.issuer || '');
                setEnabled(!!data.isEnabled);
            }
        } catch (e) {
            console.error('Failed to load SSO config', e);
        }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
        await api.put('/auth/sso/config', {
            provider,
            clientId,
            clientSecret,
            issuer,
            isEnabled: enabled
        });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
        console.error(e);
        // Could set an error state here
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-default-500 bg-clip-text text-transparent">
          Single Sign-On (SSO)
        </h1>
        <p className="text-default-500 mt-1">Configure enterprise authentication for your team</p>
      </div>

      <Card className="border border-default-200">
        <CardBody className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon.Key className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Enable SSO</h3>
                        <p className="text-xs text-default-400">Allow users to sign in using your Identity Provider</p>
                    </div>
                </div>
                <Switch isSelected={enabled} onValueChange={setEnabled} />
            </div>

            <Divider />
            
            <div className={`space-y-6 transition-all duration-300 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Select 
                        label="Identity Provider" 
                        selectedKeys={[provider]} 
                        onChange={(e) => setProvider(e.target.value)}
                        variant="bordered"
                    >
                        {PROVIDERS.map(p => (
                            <SelectItem key={p.key} textValue={p.label}>
                                <div className="flex items-center gap-2">
                                    {/* Icons could go here */}
                                    {p.label}
                                </div>
                            </SelectItem>
                        ))}
                    </Select>
                    
                    <Input 
                        label="Issuer URL" 
                        placeholder="https://accounts.google.com" 
                        value={issuer}
                        onValueChange={setIssuer}
                        variant="bordered"
                        description="The OIDC Issuer URL (e.g. https://accounts.google.com)"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input 
                        label="Client ID" 
                        placeholder="Enter Client ID" 
                        value={clientId}
                        onValueChange={setClientId}
                        variant="bordered"
                    />
                    <Input 
                        label="Client Secret" 
                        type="password"
                        placeholder="•••••••••••••••" 
                        value={clientSecret}
                        onValueChange={setClientSecret}
                        variant="bordered"
                    />
                </div>
                
                {provider === 'generic-oidc' && (
                    <div className="space-y-4 p-4 bg-default-50 rounded-lg border border-default-200">
                         <h4 className="text-sm font-semibold text-default-600">Advanced Endpoint Configuration</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Authorization Endpoint" value={authEndpoint} onValueChange={setAuthEndpoint} size="sm" />
                            <Input label="Token Endpoint" value={tokenEndpoint} onValueChange={setTokenEndpoint} size="sm" />
                            <Input label="User Info Endpoint" value={userInfoEndpoint} onValueChange={setUserInfoEndpoint} size="sm" />
                         </div>
                    </div>
                )}
            </div>
            
            <div className="flex justify-end pt-4">
                <Button 
                    color="primary" 
                    onPress={handleSave} 
                    isLoading={isLoading}
                    className="font-medium shadow-lg shadow-primary/20"
                >
                    {isSaved ? 'Saved Successfully' : 'Save Configuration'}
                </Button>
            </div>
        </CardBody>
      </Card>
      
      {/* Help Section */}
      <Card className="bg-default-50 border border-default-200">
          <CardBody className="p-4 flex gap-4">
              <Icon.Info className="w-6 h-6 text-default-400 mt-1" />
              <div className="text-sm text-default-500">
                  <h4 className="font-semibold text-default-700 mb-1">Callback URL</h4>
                  <p className="mb-2">Add this URL to your Identity Provider's allowed redirect URIs:</p>
                  <code className="px-2 py-1 bg-default-200 rounded text-default-800 font-mono">
                      https://app.zcr.ai/api/auth/sso/callback
                  </code>
              </div>
          </CardBody>
      </Card>
    </div>
  );
}
