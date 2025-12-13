import { useEffect, useState } from 'react';
import { 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input, Checkbox,
  Card, CardBody, CardHeader, Button, Select, SelectItem
} from "@heroui/react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Icon } from '../../shared/ui/icon';
import { api } from '../../shared/api/api';

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

function ScheduleModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState('');
  
  const handleSave = () => {
    // Mock save
    alert('Schedule saved! Reports will be sent to ' + emails);
    onClose();
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
                <Input
                  label="Recipients"
                  placeholder="email@example.com, manager@example.com"
                  description="Comma separated emails"
                  value={emails}
                  onValueChange={setEmails}
                  startContent={<Icon.Mail className="w-4 h-4 text-default-400" />}
                />
                
                <div className="flex gap-2">
                   <Checkbox defaultSelected>Include Executive Summary</Checkbox>
                </div>
                <div className="flex gap-2">
                   <Checkbox defaultSelected>Include Detailed Charts</Checkbox>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave} startContent={<Icon.CheckCircle className="w-4 h-4" />}>
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
      
      const res = await api.get(`/api/analytics/dashboard?${params.toString()}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  if (loading && !data) {
     return <div className="p-8 text-center flex flex-col items-center justify-center h-[50vh] gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        <p className="text-gray-400">Generating Analytics Report...</p>
     </div>;
  }

  // Transform data for Recharts
  const statusData = data?.distribution.status.map((item: any) => ({ name: item.status, value: Number(item.count) })) || [];
  const severityData = data?.distribution.severity.map((item: any) => ({ name: item.severity, value: Number(item.count) })) || [];
  const typeData = data?.distribution.type.map((item: any) => ({ name: item.type, value: Number(item.count) })) || [];
  const volumeData = data?.trends.volume.map((item: any) => ({ date: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: Number(item.count) })) || [];

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
            ['Total Cases', data.totals.cases],
            ['Resolved Cases', data.totals.resolved],
            ['Mean Time to Resolve (MTTR)', `${data.totals.mttrHours} hours`],
            ['Resolution Rate', `${((data.totals.resolved / (data.totals.cases || 1)) * 100).toFixed(1)}%`]
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

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
    }

    doc.save(`zcraI_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-content1/50 p-6 rounded-2xl border border-white/5 backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Analytics & Reports</h1>
          <p className="text-default-500 mt-1">Operational insights and performance metrics.</p>
        </div>
        <div className="flex gap-3 items-center mt-4 md:mt-0">
             <Select 
                defaultSelectedKeys={[timeRange]}
                className="w-40" 
                size="sm"
                onChange={(e) => setTimeRange(e.target.value)}
                aria-label="Time Range"
             >
                {TIME_RANGES.map((range) => (
                    <SelectItem key={range.value}>
                        {range.label}
                    </SelectItem>
                ))}
            </Select>
            <Button 
                color="primary" 
                className="font-semibold shadow-lg shadow-primary/20"
                startContent={<Icon.Document className="size-4" />}
                onPress={handleExportPDF}
                isDisabled={loading || !data}
            >
                Export PDF
            </Button>
            <Button
                variant="flat"
                color="secondary"
                startContent={<Icon.Clock className="size-4" />}
                onPress={onOpen}
            >
                Schedule
            </Button>
        </div>
      </div>

      <ScheduleModal isOpen={isOpen} onClose={onClose} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-l-4 border-l-blue-500 border-white/5">
            <CardBody className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Total Cases</p>
                        <p className="text-3xl font-bold">{data?.totals.cases || 0}</p>
                    </div>
                    <Icon.Briefcase className="w-5 h-5 text-blue-500 opacity-50" />
                </div>
            </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-l-4 border-l-green-500 border-white/5">
            <CardBody className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-1">Resolved</p>
                        <p className="text-3xl font-bold">{data?.totals.resolved || 0}</p>
                    </div>
                    <Icon.Shield className="w-5 h-5 text-green-500 opacity-50" />
                </div>
            </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-l-4 border-l-purple-500 border-white/5">
            <CardBody className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Avg. MTTR</p>
                        <p className="text-3xl font-bold">{data?.totals.mttrHours || 0} <span className="text-sm font-normal text-gray-500">hrs</span></p>
                    </div>
                    <Icon.Clock className="w-5 h-5 text-purple-500 opacity-50" />
                </div>
            </CardBody>
        </Card>
         <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-l-4 border-l-orange-500 border-white/5">
            <CardBody className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Crit/High Ratio</p>
                        <p className="text-3xl font-bold">
                             {data?.totals.cases ? ((severityData.filter((d:any) => d.name === 'critical' || d.name === 'high').reduce((a:any,b:any) => a + b.value, 0) / data.totals.cases) * 100).toFixed(0) : 0}
                             <span className="text-sm font-normal text-gray-500">%</span>
                        </p>
                    </div>
                    <Icon.Alert className="w-5 h-5 text-orange-500 opacity-50" />
                </div>
            </CardBody>
        </Card>
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume Trend (Wide) */}
        <Card className="lg:col-span-2 bg-content1/50 border border-white/5 p-4">
            <CardHeader className="pb-0">
                <h3 className="text-lg font-semibold">Incident Volume Trend</h3>
            </CardHeader>
            <CardBody className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeData}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#3B82F6', strokeWidth: 1 }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardBody>
        </Card>

        {/* Severity Donut */}
        <Card className="bg-content1/50 border border-white/5 p-4">
            <CardHeader className="pb-0">
                <h3 className="text-lg font-semibold">Severity Breakdown</h3>
            </CardHeader>
            <CardBody className="h-[350px] flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={severityData}
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {severityData.map((entry: any, index: number) => {
                                const color = SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS] || COLORS[index % COLORS.length];
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Pie>
                        <Tooltip 
                             contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }}
                             itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </CardBody>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
            {/* Status Bar */}
            <Card className="bg-content1/50 border border-white/5 p-4">
                <CardHeader className="pb-0">
                    <h3 className="text-lg font-semibold">Case Status Distribution</h3>
                </CardHeader>
                <CardBody className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData} layout="vertical" barCategoryGap="20%">
                             <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                             <XAxis type="number" stroke="#666" fontSize={11} hide />
                             <YAxis dataKey="name" type="category" stroke="#999" fontSize={12} width={100} tickLine={false} axisLine={false} />
                             <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }} />
                             <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} barSize={32}>
                                {statusData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'resolved' ? '#10B981' : '#3B82F6'} />
                                ))}
                             </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardBody>
            </Card>

             {/* Type/Source (Placeholder for now until real source data) */}
             <Card className="bg-content1/50 border border-white/5 p-4">
                <CardHeader className="pb-0">
                    <h3 className="text-lg font-semibold">Alert Types</h3>
                </CardHeader>
                <CardBody className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                                data={typeData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                                labelLine={false}
                                dataKey="value"
                                stroke="none"
                            >
                                {typeData.map((_entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardBody>
            </Card>
       </div>
    </div>
  );
}
