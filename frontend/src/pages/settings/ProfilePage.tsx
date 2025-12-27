import { useEffect, useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Avatar, Chip, Switch, Divider, 
  Textarea
} from "@heroui/react";
import { api } from "@/shared/api";
import { useAuth } from "../../shared/store/useAuth";
import { Icon, ConfirmDialog } from "@/shared/ui";

interface Session {
  id: string;
  device: string; // The backend returns userAgent, we might need to parse or just show it
  ipAddress: string | null;
  userAgent: string | null;
  lastActive: string;
  isCurrent: boolean;
}

interface UserProfile {
  name: string | null;
  email: string;
  jobTitle?: string;
  phoneNumber?: string;
  bio?: string;
  emailAlertsEnabled?: boolean;
  marketingOptIn?: boolean;
  mfaEnabled: boolean;
  tenant?: {
    apiUsage: number;
    apiLimit: number;
  };
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.name || user?.email?.split('@')[0] || 'Admin User');
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Security
  const [mfaEnabled, setMfaEnabled] = useState(false);
  
  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // API Usage
  const [apiUsage, setApiUsage] = useState(0);
  const [apiLimit, setApiLimit] = useState(10000);
  
  // Confirmation State
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get<UserProfile>('/profile');
        if (data) {
           setName(data.name || data.email.split('@')[0]);
           setEmail(data.email);
           setJobTitle(data.jobTitle || '');
           setPhoneNumber(data.phoneNumber || '');
           setBio(data.bio || '');
           // Notifications
           setNotifEmail(data.emailAlertsEnabled ?? true);
           setNotifMarketing(data.marketingOptIn ?? false);
           setMfaEnabled(data.mfaEnabled);
        }
        if (data.tenant) {
          setApiUsage(data.tenant.apiUsage);
          setApiLimit(data.tenant.apiLimit);
        }

        // Fetch Sessions
        const { data: sessionsData } = await api.get<Session[]>('/profile/sessions');
        setSessions(sessionsData);
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) {
        setEmail(user.email);
        if (user.name) setName(user.name);
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      await api.put('/profile', { 
        email,
        name,
        jobTitle,
        phoneNumber,
        bio
      });
      alert('Profile updated successfully');
    } catch (error) {
       const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNotifications = async (key: 'emailAlertsEnabled' | 'marketingOptIn', value: boolean) => {
      try {
          if (key === 'emailAlertsEnabled') setNotifEmail(value);
          if (key === 'marketingOptIn') setNotifMarketing(value);
          
          await api.put('/profile', { 
            [key]: value 
          });
      } catch (e) {
          console.error('Failed to update notifications', e);
          // Revert on failure
          if (key === 'emailAlertsEnabled') setNotifEmail(!value);
          if (key === 'marketingOptIn') setNotifMarketing(!value);
      }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await api.put('/profile/password', { currentPassword, newPassword });
      alert('Password changed successfully. Please login again.');
      await logout();
    } catch (error) {
       const err = error as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRevokeSession = async () => {
    if (!sessionToRevoke) return;
    setRevoking(true);
    try {
        await api.delete(`/profile/sessions/${sessionToRevoke}`);
        setSessions(sessions.filter(s => s.id !== sessionToRevoke));
        alert('Session revoked successfully');
    } catch (e) {
        console.error('Failed to revoke session', e);
        alert('Failed to revoke session');
    } finally {
        setRevoking(false);
        setSessionToRevoke(null);
    }
  };

  return (
    <div className="w-full space-y-6 pb-20 animate-fade-in pt-6">
      {/* Profile Header */}
      <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
        <CardBody className="p-8 flex flex-row items-center gap-6">
          <div className="relative">
             <Avatar 
                src="https://i.pravatar.cc/150?u=a042581f4e29026704d" 
                className="w-24 h-24 text-large border-4 border-background"
                isBordered
                color="primary"
             />
             <div className="absolute bottom-0 right-0 bg-success w-6 h-6 rounded-full border-4 border-content1 flex items-center justify-center">
                 <Icon.CheckCircle className="w-3 h-3 text-white" />
             </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center gap-3">
                 <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">{name}</h1>
                 <Chip color="primary" variant="flat" size="sm">Admin</Chip>
                 <Chip color="warning" variant="flat" size="sm">Pro Plan</Chip>
             </div>
             <p className="text-foreground/60 mt-1">{email} • zcr.ai Organization</p>
             <div className="flex gap-4 mt-4 text-xs text-foreground/60">
                 <div className="flex items-center gap-1"><Icon.Map className="w-4 h-4"/> Bangkok, Thailand</div>
                 <div className="flex items-center gap-1"><Icon.Clock className="w-4 h-4"/> Local Time: 14:30 PM</div>
             </div>
          </div>
          <div className="flex gap-3">
             <Button variant="bordered" startContent={<Icon.Download className="w-4 h-4"/>}>Export Data</Button>
             <Button color="primary" variant="shadow" startContent={<Icon.Edit className="w-4 h-4"/>} onPress={handleUpdateProfile}>Edit Profile</Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-12 gap-6">
          {/* Main Content - Left Column */}
          <div className="col-span-8 space-y-6">
              
              {/* Personal Info */}
              <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6 flex justify-between items-start">
                      <div>
                        <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Personal Information</h3>
                        <p className="text-foreground/60 text-sm mt-1">Update your personal details and contact info.</p>
                      </div>
                      <Icon.User className="w-4 h-4 text-foreground/30" />
                  </CardHeader>
                  <CardBody className="p-6 grid grid-cols-2 gap-4">
                      <Input label="Display Name" value={name} onValueChange={setName} variant="bordered" />
                      <Input label="Email Address" value={email} onValueChange={setEmail} variant="bordered" />
                      <Input label="Job Title" placeholder="Security Analyst" value={jobTitle} onValueChange={setJobTitle} variant="bordered" />
                      <Input label="Phone Number" placeholder="+66 81 234 5678" value={phoneNumber} onValueChange={setPhoneNumber} variant="bordered" />
                      <div className="col-span-2">
                          <Textarea label="Bio" placeholder="Tell us a little about yourself..." value={bio} onValueChange={setBio} minRows={2} variant="bordered"/>
                      </div>
                  </CardBody>
              </Card>

              {/* Security Center */}
              <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6 flex justify-between items-start">
                      <div>
                        <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Security Center</h3>
                        <p className="text-foreground/60 text-sm mt-1">Manage your password and authentication methods.</p>
                      </div>
                      <Icon.Shield className="w-4 h-4 text-success" />
                  </CardHeader>
                  <CardBody className="p-6 space-y-6">
                      <div className="p-4 rounded-lg bg-content2/50 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <div className="p-2 rounded bg-primary/10 text-primary"><Icon.Lock className="w-5 h-5"/></div>
                              <div>
                                  <div className="font-semibold">Two-Factor Authentication (2FA)</div>
                                  <div className="text-sm text-foreground/60">Secure your account with TOTP (Google Authenticator)</div>
                              </div>
                          </div>
                          <Switch isSelected={mfaEnabled} onValueChange={setMfaEnabled} color="success"/>
                      </div>

                      <Divider className="bg-white/10" />

                      <div className="space-y-4">
                          <h3 className="text-sm font-semibold">Change Password</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <Input label="Current Password" type="password" value={currentPassword} onValueChange={setCurrentPassword} variant="bordered" />
                              <div className="col-span-1"></div> {/* Spacer */}
                              <Input label="New Password" type="password" value={newPassword} onValueChange={setNewPassword} variant="bordered" />
                              <Input label="Confirm Password" type="password" value={confirmPassword} onValueChange={setConfirmPassword} variant="bordered" />
                          </div>
                          <div className="flex justify-end">
                              <Button size="sm" color="primary" variant="flat" onPress={handleChangePassword} isLoading={isLoading}>Update Password</Button>
                          </div>
                      </div>
                  </CardBody>
              </Card>

               {/* Session History */}
               <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6">
                      <div>
                        <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Active Sessions</h3>
                        <p className="text-foreground/60 text-sm mt-1">Manage devices logged into your account.</p>
                      </div>
                  </CardHeader>
                  <CardBody className="p-6">
                      <div className="space-y-4">
                          {sessions.map(session => (
                              <div key={session.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 transition-colors group">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-content2 flex items-center justify-center">
                                          {(session.userAgent?.includes('iPhone') || session.userAgent?.includes('Mobile')) ? <Icon.DevicePhoneMobile className="w-5 h-5"/> : <Icon.DeviceComputer className="w-5 h-5"/>}
                                      </div>
                                      <div>
                                          <div className="font-medium flex items-center gap-2">
                                              {session.userAgent ? (session.userAgent.length > 30 ? session.userAgent.substring(0, 30) + '...' : session.userAgent) : 'Unknown Device'}
                                              {/* For now we don't know current, so hide chip or logic needed */}
                                              {/* {session.current && <Chip size="sm" color="success" variant="flat" className="h-4 text-[10px]">Current</Chip>} */}
                                          </div>
                                          <div className="text-xs text-foreground/60">
                                            {session.ipAddress || 'Unknown IP'} • <span className="text-foreground/70">{new Date(session.lastActive).toLocaleDateString()} {new Date(session.lastActive).toLocaleTimeString()}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <Button size="sm" color="danger" variant="light" className="opacity-0 group-hover:opacity-100" onPress={() => setSessionToRevoke(session.id)}>Revoke</Button>
                              </div>
                          ))}
                          {sessions.length === 0 && <div className="text-center text-foreground/60 py-4">No active sessions found.</div>}
                      </div>
                  </CardBody>
               </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="col-span-4 space-y-6">
              {/* Notification Preferences */}
              <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6">
                      <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Notifications</h3>
                  </CardHeader>
                  <CardBody className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Email Alerts</span>
                          <Switch size="sm" isSelected={notifEmail} onValueChange={(v) => handleUpdateNotifications('emailAlertsEnabled', v)} />
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Security Alerts</span>
                          <Switch size="sm" isSelected={notifSecurity} onValueChange={setNotifSecurity} isDisabled defaultSelected />
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Marketing Emails</span>
                          <Switch size="sm" isSelected={notifMarketing} onValueChange={(v) => handleUpdateNotifications('marketingOptIn', v)} />
                      </div>
                  </CardBody>
              </Card>

               {/* API Usage */}
               <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6">
                      <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">API Usage</h3>
                  </CardHeader>
                  <CardBody className="p-6">
                      <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                              <span>Monthly Requests</span>
                              <span className="font-mono font-bold">{apiUsage.toLocaleString()} / {apiLimit.toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full bg-content2 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((apiUsage / apiLimit) * 100, 100)}%` }}
                              />
                          </div>
                      </div>
                      <Button fullWidth variant="flat" color="primary">Upgrade Plan</Button>
                  </CardBody>
              </Card>
      </div>
    </div>
      
      <ConfirmDialog 
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={confirmRevokeSession}
        title="Revoke Session"
        description="Are you sure you want to revoke this session? The user will be logged out from that device."
        confirmLabel="Revoke"
        confirmColor="danger"
        isLoading={revoking}
      />
    </div>
  );
}
