import { Card, CardBody, Button } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="p-8 min-h-screen dark bg-background text-foreground">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
          zcrAI Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <p>Welcome, {user?.email}</p>
          <Button color="danger" variant="light" onPress={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-xl font-bold mb-2">System Status</h2>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-green-500">All Systems Operational</p>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-xl font-bold mb-2">Active Threats</h2>
            <p className="text-danger text-3xl font-mono">0</p>
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-xl font-bold mb-2">Connected Tenants</h2>
            <p className="text-primary text-3xl font-mono">1</p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button color="primary" variant="shadow">
          Scan for Threats
        </Button>
        <Button color="secondary" variant="flat">
          View Reports
        </Button>
        <Button color="warning" variant="flat" onPress={() => navigate('/settings/mfa')}>
          🔐 Setup MFA
        </Button>
      </div>
    </div>
  );
}
