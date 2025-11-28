import { useEffect, useState } from "react";
import { Card, CardBody, Button, Spinner, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { useAuth } from "../../shared/store/useAuth";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/api";

interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

interface TopHost {
  host_name: string;
  count: string;
  critical: string;
  high: string;
}

interface SourceBreakdown {
  source: string;
  count: string;
}

export default function DashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topHosts, setTopHosts] = useState<TopHost[]>([]);
  const [sources, setSources] = useState<SourceBreakdown[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [summaryRes, hostsRes, sourcesRes] = await Promise.all([
        api.get('/dashboard/summary?days=7'),
        api.get('/dashboard/top-hosts?days=7&limit=5'),
        api.get('/dashboard/sources?days=7'),
      ]);
      setSummary(summaryRes.data);
      setTopHosts(hostsRes.data);
      setSources(sourcesRes.data);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

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
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-danger-50 border border-danger">
          <CardBody className="text-center">
            <p className="text-sm text-danger-600">Critical</p>
            <p className="text-3xl font-bold text-danger">{summary?.critical || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-warning-50 border border-warning">
          <CardBody className="text-center">
            <p className="text-sm text-warning-600">High</p>
            <p className="text-3xl font-bold text-warning">{summary?.high || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-secondary-50 border border-secondary">
          <CardBody className="text-center">
            <p className="text-sm text-secondary-600">Medium</p>
            <p className="text-3xl font-bold text-secondary">{summary?.medium || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-primary-50 border border-primary">
          <CardBody className="text-center">
            <p className="text-sm text-primary-600">Low</p>
            <p className="text-3xl font-bold text-primary">{summary?.low || 0}</p>
          </CardBody>
        </Card>
        <Card className="bg-default-100 border border-default">
          <CardBody className="text-center">
            <p className="text-sm text-default-600">Total</p>
            <p className="text-3xl font-bold">{summary?.total || 0}</p>
          </CardBody>
        </Card>
      </div>

      {/* Top Hosts & Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-xl font-bold mb-4">Top Hosts (7 days)</h2>
            <Table aria-label="Top hosts" removeWrapper>
              <TableHeader>
                <TableColumn>Host</TableColumn>
                <TableColumn>Events</TableColumn>
                <TableColumn>Critical</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No hosts found">
                {topHosts.map((host, i) => (
                  <TableRow key={i}>
                    <TableCell>{host.host_name}</TableCell>
                    <TableCell>{host.count}</TableCell>
                    <TableCell className="text-danger">{host.critical}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        <Card className="bg-content1">
          <CardBody>
            <h2 className="text-xl font-bold mb-4">Sources (7 days)</h2>
            <Table aria-label="Sources" removeWrapper>
              <TableHeader>
                <TableColumn>Source</TableColumn>
                <TableColumn>Events</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No sources found">
                {sources.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="capitalize">{s.source}</TableCell>
                    <TableCell>{s.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button color="primary" variant="shadow" onPress={() => navigate('/logs')}>
          📋 View Logs
        </Button>
        <Button color="secondary" variant="flat" onPress={loadDashboard}>
          🔄 Refresh
        </Button>
        <Button color="default" variant="flat" onPress={() => navigate('/settings')}>
          ⚙️ Settings
        </Button>
      </div>
    </div>
  );
}
