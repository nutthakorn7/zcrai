import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input } from "@heroui/react";
import { api } from "../../shared/api/api";
import { useAuth } from "../../shared/store/useAuth";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [isLoading, setIsLoading] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card className="bg-content1">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">General Information</h3>
          <Input
            label="Email"
            value={email}
            onValueChange={setEmail}
          />
          <Button color="primary" onPress={handleUpdateProfile} isLoading={isLoading} className="w-fit">
            Update Profile
          </Button>
        </CardBody>
      </Card>

      <Card className="bg-content1">
        <CardBody className="space-y-4">
          <h3 className="text-lg font-semibold">Change Password</h3>
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onValueChange={setCurrentPassword}
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onValueChange={setConfirmPassword}
          />
          <Button color="secondary" onPress={handleChangePassword} isLoading={isLoading} className="w-fit">
            Change Password
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
