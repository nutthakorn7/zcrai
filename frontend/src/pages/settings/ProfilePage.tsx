import { useEffect, useState } from 'react';
import { 
  Card, CardBody, CardHeader, Button, Input, Avatar, Chip, Switch, Divider, 
  Tabs, Tab 
} from "@heroui/react";
import { api } from "../../shared/api/api";
import { useAuth } from "../../shared/store/useAuth";
import { Icon } from "../../shared/ui";

const MOCK_SESSIONS = [
  { id: 1, device: 'MacBook Pro', location: 'Bangkok, TH', ip: '45.118.132.160', lastActive: 'Current Session', current: true },
  { id: 2, device: 'iPhone 15 Pro', location: 'Chiang Mai, TH', ip: '171.96.x.x', lastActive: '2 hours ago', current: false },
  { id: 3, device: 'Windows PC', location: 'Bangkok, TH', ip: '124.120.x.x', lastActive: '2 days ago', current: false },
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [name, setName] = useState(user?.email?.split('@')[0] || 'Admin User');
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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/profile');
        if (data.tenant) {
          setApiUsage(data.tenant.apiUsage);
          setApiLimit(data.tenant.apiLimit);
        }
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (user) setEmail(user.email);
  }, [user]);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      await api.put('/profile', { email });
      alert('Profile updated successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsLoading(false);
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
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in pt-6">
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
                 <h1 className="text-2xl font-bold">{name}</h1>
                 <Chip color="primary" variant="flat" size="sm">Admin</Chip>
                 <Chip color="warning" variant="flat" size="sm">Pro Plan</Chip>
             </div>
             <p className="text-foreground/50 mt-1">{email} • zcr.ai Organization</p>
             <div className="flex gap-4 mt-4 text-xs text-foreground/50">
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
                        <h3 className="text-lg font-bold">Personal Information</h3>
                        <p className="text-sm text-foreground/50">Update your personal details and contact info.</p>
                      </div>
                      <Icon.User className="w-5 h-5 text-foreground/30" />
                  </CardHeader>
                  <CardBody className="p-6 grid grid-cols-2 gap-4">
                      <Input label="display Name" value={name} onValueChange={setName} variant="bordered" />
                      <Input label="Email Address" value={email} onValueChange={setEmail} variant="bordered" />
                      <Input label="Job Title" placeholder="Security Analyst" variant="bordered" />
                      <Input label="Phone Number" placeholder="+66 81 234 5678" variant="bordered" />
                      <div className="col-span-2">
                          <Textarea label="Bio" placeholder="Tell us a little about yourself..." minRows={2} variant="bordered"/>
                      </div>
                  </CardBody>
              </Card>

              {/* Security Center */}
              <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6 flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold">Security Center</h3>
                        <p className="text-sm text-foreground/50">Manage your password and authentication methods.</p>
                      </div>
                      <Icon.Shield className="w-5 h-5 text-success" />
                  </CardHeader>
                  <CardBody className="p-6 space-y-6">
                      <div className="p-4 rounded-lg bg-content2/50 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <div className="p-2 rounded bg-primary/10 text-primary"><Icon.Lock className="w-5 h-5"/></div>
                              <div>
                                  <div className="font-semibold">Two-Factor Authentication (2FA)</div>
                                  <div className="text-sm text-foreground/50">Secure your account with TOTP (Google Authenticator)</div>
                              </div>
                          </div>
                          <Switch isSelected={mfaEnabled} onValueChange={setMfaEnabled} color="success"/>
                      </div>

                      <Divider className="bg-white/10" />

                      <div className="space-y-4">
                          <h4 className="text-sm font-semibold">Change Password</h4>
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
                        <h3 className="text-lg font-bold">Active Sessions</h3>
                        <p className="text-sm text-foreground/50">Manage devices logged into your account.</p>
                      </div>
                  </CardHeader>
                  <CardBody className="p-6">
                      <div className="space-y-4">
                          {MOCK_SESSIONS.map(session => (
                              <div key={session.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 transition-colors group">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-content2 flex items-center justify-center">
                                          {session.device.includes('iPhone') ? <Icon.DevicePhoneMobile className="w-5 h-5"/> : <Icon.DeviceComputer className="w-5 h-5"/>}
                                      </div>
                                      <div>
                                          <div className="font-medium flex items-center gap-2">
                                              {session.device}
                                              {session.current && <Chip size="sm" color="success" variant="flat" className="h-4 text-[10px]">Current</Chip>}
                                          </div>
                                          <div className="text-xs text-foreground/50">{session.location} • {session.ip} • <span className="text-foreground/70">{session.lastActive}</span></div>
                                      </div>
                                  </div>
                                  {!session.current && <Button size="sm" color="danger" variant="light" className="opacity-0 group-hover:opacity-100">Revoke</Button>}
                              </div>
                          ))}
                      </div>
                  </CardBody>
               </Card>
          </div>

          {/* Sidebar - Right Column */}
          <div className="col-span-4 space-y-6">
              {/* Notification Preferences */}
              <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6">
                      <h3 className="text-lg font-bold">Notifications</h3>
                  </CardHeader>
                  <CardBody className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Email Alerts</span>
                          <Switch size="sm" isSelected={notifEmail} onValueChange={setNotifEmail} />
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Security Alerts</span>
                          <Switch size="sm" isSelected={notifSecurity} onValueChange={setNotifSecurity} isDisabled defaultSelected />
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm">Marketing Emails</span>
                          <Switch size="sm" isSelected={notifMarketing} onValueChange={setNotifMarketing} />
                      </div>
                  </CardBody>
              </Card>

               {/* API Usage */}
               <Card className="bg-content1/50 border border-white/5">
                  <CardHeader className="pb-0 pt-6 px-6">
                      <h3 className="text-lg font-bold">API Usage</h3>
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
    </div>
  );
}

// Add Textarea to imports if missing, or use Input with type="textarea" if older NextUI
import { Textarea } from "@heroui/react";

