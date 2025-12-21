import { useEffect, useState } from 'react';
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input,
  Card, CardBody, CardHeader, Button, Select, SelectItem, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip
} from "@heroui/react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Icon } from '../../shared/ui/icon';
import { api } from '../../shared/api/api';
import { CustomReportTab } from './CustomReportTab';

// Use same colors as Dashboard
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const SEVERITY_COLORS = {
  critical: '#EF4444', 
  high: '#F97316', 
  medium: '#EAB308', 
  low: '#3B82F6',
  info: '#9CA3AF'
};

const TIME_RANGES = [
    { label: "Last 24 Hours", value: "24h" },
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 90 Days", value: "90d" },
    { label: "All Time", value: "all" },
];

function ScheduleModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [emails, setEmails] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [loading, setLoading] = useState(false);
  
  const handleSave = async () => {
    if (!emails) return;
    setLoading(true);
    try {
        await api.post('/reports/schedules', {
            reportType: 'dashboard',
            frequency,
            recipients: emails.split(',').map(e => e.trim()).filter(Boolean),
            isEnabled: true
        });
        onSuccess();
        onClose();
    } catch (e) {
        console.error(e);
        alert('Failed to save schedule');
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Schedule Automated Report
              <span className="text-xs font-normal text-default-500">Receive PDF reports automatically via email.</span>
            </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Select 
                    label="Frequency" 
                    defaultSelectedKeys={[frequency]}
                    onChange={(e) => setFrequency(e.target.value)}
                >
                    <SelectItem key="daily">Daily (Every morning)</SelectItem>
                    <SelectItem key="weekly">Weekly (Every Monday)</SelectItem>
                    <SelectItem key="monthly">Monthly (1st of month)</SelectItem>
                </Select>

                <Input
                  label="Recipients"
                  placeholder="email@example.com, manager@example.com"
                  description="Comma separated emails"
                  value={emails}
                  onValueChange={setEmails}
                  startContent={<Icon.Mail className="w-4 h-4 text-default-400" />}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave} isLoading={loading} startContent={!loading && <Icon.CheckCircle className="w-4 h-4" />}>
                Save Schedule
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState("30d");
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Schedule State
  const [schedules, setSchedules] = useState<any[]>([]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      // Determine dates based on range
      const end = new Date();
      let start = new Date();
      if (timeRange === '24h') start.setHours(start.getHours() - 24);
      if (timeRange === '7d') start.setDate(start.getDate() - 7);
      if (timeRange === '30d') start.setDate(start.getDate() - 30);
      if (timeRange === '90d') start.setDate(start.getDate() - 90);
      if (timeRange === 'all') start = new Date(0); // 1970

      const params = new URLSearchParams();
      params.append('startDate', start.toISOString());
      params.append('endDate', end.toISOString());
      
      const res = await api.get(`/dashboard/summary?${params.toString()}`);
      // Mapping API response to expected chart format if needed.
      // Assuming existing dashboard structure or similar.
      // For now, let's assume the API returns what we need or we adapt.
      // Actually, let's use the mock data structure previously used or adapt to real API.
      // The backend `getSummary` returns { totals:..., distribution:... }
      
      if (res.data) {
        setData(res.data); 
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
      try {
          const res = await api.get('/reports/schedules');
          setSchedules(res.data.data);
      } catch(e) {
          console.error(e);
      }
  };

  useEffect(() => {
    fetchMetrics();
    fetchSchedules();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const handleDeleteSchedule = async (id: string) => {
      if(!confirm('Delete this schedule?')) return;
      try {
          await api.delete(`/reports/schedules/${id}`);
          fetchSchedules();
      } catch(e) {
          alert('Failed to delete');
      }
  };

  // Transform data for Recharts (Safe access)
  const statusData = data?.distribution?.status?.map((item: any) => ({ name: item.status, value: Number(item.count) })) || [];
  const severityData = data?.distribution?.severity?.map((item: any) => ({ name: item.severity, value: Number(item.count) })) || [];
  
  // Note: Backend might not return trends.volume in getSummary yet. 
  // If missing, we show empty or mock.
  // const volumeData = data?.trends?.volume?.map(...) || [];
  // const typeData = []; 

  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();

    // Title
    doc.setFontSize(20);
    doc.text('Incident Management Report', 14, 22);
    
    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${today} | Range: ${TIME_RANGES.find(r => r.value === timeRange)?.label}`, 14, 30);
    doc.text(`Source: zcrAI SOC Platform`, 14, 35);

    // Executive Summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Executive Summary', 14, 50);
    
    autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Value']],
        body: [
            ['Total Cases', data.totals?.cases || 0],
            ['Resolved Cases', data.totals?.resolved || 0],
            ['Mean Time to Resolve (MTTR)', `${data.totals?.mttrHours || 0} hours`],
            ['Resolution Rate', `${((data.totals?.resolved / (data.totals?.cases || 1)) * 100).toFixed(1)}%`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 82, 204] } // zcrAI Blue
    });

    // Severity Breakdown
    doc.text('Severity Breakdown', 14, (doc as any).lastAutoTable.finalY + 15);
    
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Severity', 'Count']],
        body: severityData.map((d: any) => [d.name.toUpperCase(), d.value]),
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] }
    });

    doc.save(`zcraI_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="p-6 min-h-screen bg-background space-y-6">
      <div className="flex justify-between items-center bg-content1/50 p-6 rounded-2xl border border-white/5 backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Analytics & Reports</h1>
          <p className="text-default-500 mt-1">Operational insights and performance metrics.</p>
        </div>
      </div>

      <Tabs aria-label="Report Options" color="primary" variant="underlined">
        <Tab key="dashboard" title="Dashboard Report">
            <div className="space-y-6 mt-4">
                 {/* Filters */}
                 <div className="flex justify-end gap-3">
                    <Select 
                        defaultSelectedKeys={[timeRange]}
                        className="w-40" 
                        size="sm"
                        onChange={(e) => setTimeRange(e.target.value)}
                        aria-label="Time Range"
                    >
                        {TIME_RANGES.map((range) => (
                            <SelectItem key={range.value}>{range.label}</SelectItem>
                        ))}
                    </Select>
                    <Button 
                        color="primary" 
                        onPress={handleExportPDF}
                        isDisabled={loading || !data}
                        startContent={<Icon.Document className="size-4" />}
                    >
                        Export PDF
                    </Button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-l-4 border-l-blue-500 border-white/5">
                        <CardBody className="p-6">
                            <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Total Cases</p>
                            <p className="text-3xl font-bold">{data?.totals?.cases || 0}</p>
                        </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-l-4 border-l-green-500 border-white/5">
                        <CardBody className="p-6">
                            <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">Resolved</p>
                            <p className="text-3xl font-bold">{data?.totals?.resolved || 0}</p>
                        </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-l-4 border-l-purple-500 border-white/5">
                        <CardBody className="p-6">
                            <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Avg. MTTR</p>
                            <p className="text-3xl font-bold">{data?.totals?.mttrHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span></p>
                        </CardBody>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-l-4 border-l-orange-500 border-white/5">
                        <CardBody className="p-6">
                            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Critical/High</p>
                            <p className="text-3xl font-bold">
                                {data?.totals?.cases ? ((severityData.filter((d:any) => d.name === 'critical' || d.name === 'high').reduce((a:any,b:any) => a + b.value, 0) / data.totals.cases) * 100).toFixed(0) : 0}%
                            </p>
                        </CardBody>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                    <Card className="bg-content1/50 border border-white/5 p-4">
                        <CardHeader><h3 className="text-lg font-semibold">Severity Breakdown</h3></CardHeader>
                        <CardBody className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={severityData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {severityData.map((entry: any, index: number) => {
                                            const color = SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS] || COLORS[index % COLORS.length];
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardBody>
                    </Card>
                    
                    <Card className="bg-content1/50 border border-white/5 p-4">
                        <CardHeader><h3 className="text-lg font-semibold">Case Status</h3></CardHeader>
                        <CardBody className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} layout="vertical">
                                     <XAxis type="number" hide />
                                     <YAxis dataKey="name" type="category" width={100} />
                                     <Tooltip cursor={{fill: 'transparent'}} />
                                     <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </Tab>

        <Tab key="custom" title="Custom Builder">
            <CustomReportTab />
        </Tab>
        
        <Tab key="schedules" title="Scheduled Reports">
             <div className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                    <p className="text-default-500">Manage automated email reports.</p>
                    <Button color="primary" onPress={onOpen} startContent={<Icon.Clock className="w-4 h-4"/>}>
                        Create Schedule
                    </Button>
                </div>

                <Table 
                    aria-label="Schedules Table"
                >
                    <TableHeader>
                        <TableColumn>REPORT TYPE</TableColumn>
                        <TableColumn>FREQUENCY</TableColumn>
                        <TableColumn>RECIPIENTS</TableColumn>
                        <TableColumn>NEXT RUN</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody items={schedules} emptyContent="No schedules found.">
                        {(item: any) => (
                            <TableRow key={item.id}>
                                <TableCell className="capitalize">{item.reportType}</TableCell>
                                <TableCell className="capitalize">
                                    <Chip size="sm" variant="flat" color="secondary">{item.frequency}</Chip>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        {item.recipients.map((email: string) => (
                                            <span key={email} className="text-tiny text-default-500">{email}</span>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>{new Date(item.nextRunAt).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Chip size="sm" color="success" variant="dot">Active</Chip>
                                </TableCell>
                                <TableCell>
                                    <Button size="sm" color="danger" variant="light" onPress={() => handleDeleteSchedule(item.id)}>
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
             </div>
        </Tab>
      </Tabs>

      <ScheduleModal isOpen={isOpen} onClose={onClose} onSuccess={() => { fetchSchedules(); }} />
    </div>
  );
}
