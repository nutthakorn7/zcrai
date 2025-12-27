import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Chip, Spinner, Tabs, Tab, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Select, SelectItem } from "@heroui/react";
import { FileText, Download, ShieldCheck, Lock, Trash2, Plus, Mail } from 'lucide-react';
import { api } from '../../shared/api';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportStats {
    alertCount: number;
    criticalCount: number;
    roiTimeSaved: number;
    topThreats: { name: string; count: number }[];
    periodStart: string;
    periodEnd: string;
}

interface Schedule {
    id: string;
    reportType: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    nextRunAt: string;
    lastRunAt: string;
    isEnabled: boolean;
}

export default function ReportsPage() {
    const [generating, setGenerating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("insights");
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    
    // Schedule State
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    
    // Create Schedule Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newSchedule, setNewSchedule] = useState({
        reportType: 'SOC2',
        frequency: 'weekly',
        recipients: '' // comma separated string for input
    });
    const [creating, setCreating] = useState(false);
    
    // Delete Confirmation
    const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (activeTab === 'scheduled') {
            fetchSchedules();
        } else if (activeTab === 'insights') {
            fetchStats();
        }
    }, [activeTab]);

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await api.get('/reports/stats');
            setStats(res.data);
        } catch (e) {
            console.error("Failed to load stats", e);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchSchedules = async () => {
        setLoadingSchedules(true);
        try {
            const res = await api.get('/reports/schedules');
            setSchedules(res.data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load schedules");
        } finally {
            setLoadingSchedules(false);
        }
    };

    const handleCreateSchedule = async () => {
        setCreating(true);
        try {
            const recipientsList = newSchedule.recipients.split(',').map(e => e.trim()).filter(e => e);
            if (recipientsList.length === 0) {
                toast.error("Please enter at least one email");
                setCreating(false);
                return;
            }

            await api.post('/reports/schedules', {
                ...newSchedule,
                recipients: recipientsList
            });
            
            toast.success("Schedule created");
            setIsModalOpen(false);
            fetchSchedules();
            setNewSchedule({ reportType: 'SOC2', frequency: 'weekly', recipients: '' });
        } catch (e) {
            console.error(e);
            toast.error("Failed to create schedule");
        } finally {
            setCreating(false);
        }
    };

    const confirmDeleteSchedule = async () => {
        if (!scheduleToDelete) return;
        setDeleting(true);
        try {
            await api.delete(`/reports/schedules/${scheduleToDelete}`);
            toast.success("Schedule deleted");
            setSchedules(prev => prev.filter(s => s.id !== scheduleToDelete));
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete schedule");
        } finally {
            setDeleting(false);
            setScheduleToDelete(null); // Close dialog
        }
    };

    const handleDownload = async (type: 'SOC2' | 'ISO27001' | 'AI_ACCURACY') => {
        setGenerating(type);
        try {
            const response = await api.post('/reports/generate', { type }, {
                responseType: 'blob' // Important for PDF download
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `zcrAI_${type}_Report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Download failed", error);
            alert("Failed to generate report. Only Analysts can perform this action.");
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        Compliance Reports
                    </h1>
                    <p className="text-foreground/60 text-sm mt-1">Generate audit-ready PDF reports for compliance standards.</p>
                </div>
            </div>

            <Tabs color="primary" variant="underlined" aria-label="Report Options" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
                <Tab key="insights" title="Live Insights">
                    <div className="pt-6 space-y-6">
                        {loadingStats ? (
                            <div className="flex justify-center p-12"><Spinner size="lg" /></div>
                        ) : stats ? (
                            <>
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="bg-content1/50 border border-white/5">
                                        <CardBody className="p-6">
                                            <p className="text-sm font-medium text-foreground/60 uppercase tracking-wider">Total Alerts (7 Days)</p>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <h3 className="text-4xl font-bold font-display">{stats.alertCount}</h3>
                                                <span className="text-sm text-success">+12%</span>
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <Card className="bg-content1/50 border border-white/5">
                                        <CardBody className="p-6">
                                            <p className="text-sm font-medium text-foreground/60 uppercase tracking-wider">Critical Threats Blocked</p>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <h3 className="text-4xl font-bold font-display text-danger">{stats.criticalCount}</h3>
                                                <span className="text-sm text-foreground/40">Requires Attention</span>
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <Card className="bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10">
                                        <CardBody className="p-6">
                                            <p className="text-sm font-medium text-foreground/60 uppercase tracking-wider">Estimated Time Saved</p>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <h3 className="text-4xl font-bold font-display text-primary">
                                                    {stats.roiTimeSaved < 60 ? `${stats.roiTimeSaved}m` : `${(stats.roiTimeSaved / 60).toFixed(1)}h`}
                                                </h3>
                                                <span className="text-sm text-foreground/40">via Automation</span>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="bg-content1/50 border border-white/5">
                                        <CardBody className="p-6">
                                            <h3 className="text-lg font-semibold mb-6">Top Detected Threats</h3>
                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={stats.topThreats} layout="vertical">
                                                        <XAxis type="number" hide />
                                                        <YAxis 
                                                            dataKey="name" 
                                                            type="category" 
                                                            width={100} 
                                                            tick={{fill: '#a1a1aa', fontSize: 12}}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <Tooltip 
                                                            cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                                            contentStyle={{backgroundColor: '#18181b', border: '1px solid #27272a'}}
                                                        />
                                                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                                                            {stats.topThreats.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#8b5cf6'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardBody>
                                    </Card>
                                    
                                    <Card className="bg-content1/50 border border-white/5">
                                        <CardBody className="p-6">
                                            <h3 className="text-lg font-semibold mb-2">Automated vs Manual</h3>
                                            <p className="text-sm text-foreground/60 mb-6">Proportion of alerts handled by AI Playbooks.</p>
                                            <div className="h-[250px] flex items-center justify-center">
                                                {/* Placeholder for Pie Chart since we don't have exact split data yet, just ROI */}
                                                <div className="text-center">
                                                    <div className="text-5xl font-bold text-primary mb-2">85%</div>
                                                    <div className="text-sm text-foreground/60">Automated Resolution Rate</div>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-12 text-foreground/40">Failed to load insights.</div>
                        )}
                    </div>
                </Tab>
                <Tab key="ondemand" title="On-Demand Reports">
                    <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SOC 2 Card */}
                <Card className="bg-[#1E1B4B]/30 border border-white/10 hover:border-primary/50 transition-colors">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                                <Lock size={32} />
                            </div>
                            <Chip size="sm" variant="flat" color="primary">Available</Chip>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-display tracking-tight">SOC 2 Type II Report</h3>
                            <p className="text-foreground/60 text-sm mt-2">
                                Comprehensive audit of Access Controls. Includes user roster, role assignments, MFA status, and recent access logs.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button 
                                color="primary" 
                                className="w-full"
                                endContent={generating === 'SOC2' ? <Spinner size="sm" color="white"/> : <Download size={18}/>}
                                onPress={() => handleDownload('SOC2')}
                                isDisabled={!!generating}
                            >
                                {generating === 'SOC2' ? 'Generating PDF...' : 'Download SOC 2 Report'}
                            </Button>
                        </div>
                    </CardBody>
                </Card>

                {/* ISO 27001 Card */}
                <Card className="bg-[#1E1B4B]/30 border border-white/10 hover:border-green-500/50 transition-colors">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="p-3 bg-green-500/20 rounded-lg text-green-400">
                                <ShieldCheck size={32} />
                            </div>
                            <Chip size="sm" variant="flat" color="success">Available</Chip>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold font-display tracking-tight">ISO 27001 Report</h3>
                            <p className="text-foreground/60 text-sm mt-2">
                                Information Security Management metrics. Covers Incident Response times, Alert Volumes, and Risk Handling verdicts.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button 
                                color="success"
                                variant="flat" 
                                className="w-full"
                                endContent={generating === 'ISO27001' ? <Spinner size="sm" color="current"/> : <Download size={18}/>}
                                onPress={() => handleDownload('ISO27001')}
                                isDisabled={!!generating}
                            >
                                {generating === 'ISO27001' ? 'Generating PDF...' : 'Download ISO Report'}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
                {/* AI Accuracy Card (New) */}
                <Card className="bg-[#1E1B4B]/30 border border-white/10 hover:border-purple-500/50 transition-colors">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                                <ShieldCheck size={32} />
                            </div>
                            <Chip size="sm" variant="flat" color="secondary">New</Chip>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">AI Accuracy & ROI Report</h3>
                            <p className="text-foreground/60 text-sm mt-1">
                                Performance analysis of AI Triage. Includes Agreement Rate, Verdict breakdown, and estimated cost savings.
                            </p>
                        </div>
                        <div className="pt-4">
                            <Button 
                                color="secondary"
                                variant="flat" 
                                className="w-full"
                                endContent={generating === 'AI_ACCURACY' ? <Spinner size="sm" color="current"/> : <Download size={18}/>}
                                onPress={() => handleDownload('AI_ACCURACY')}
                                isDisabled={!!generating}
                            >
                                {generating === 'AI_ACCURACY' ? 'Generating PDF...' : 'Download ROI Report'}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
                    </div>
                </Tab>

                <Tab key="scheduled" title="Scheduled Reports">
                    <div className="pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Active Schedules</h3>
                            <Button 
                                color="primary" 
                                startContent={<Plus size={16} />}
                                onPress={() => setIsModalOpen(true)}
                            >
                                New Schedule
                            </Button>
                        </div>
                        
                        <Card className="bg-content1/50">
                            <CardBody className="p-0">
                                <Table aria-label="Scheduled Reports" removeWrapper color="primary">
                                    <TableHeader>
                                        <TableColumn>REPORT TYPE</TableColumn>
                                        <TableColumn>FREQUENCY</TableColumn>
                                        <TableColumn>RECIPIENTS</TableColumn>
                                        <TableColumn>NEXT RUN</TableColumn>
                                        <TableColumn>LAST RUN</TableColumn>
                                        <TableColumn>ACTIONS</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent={loadingSchedules ? <Spinner /> : "No active schedules found"}>
                                        {schedules.map(schedule => (
                                            <TableRow key={schedule.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {schedule.reportType === 'SOC2' && <Lock size={14} className="text-blue-400" />}
                                                        {schedule.reportType === 'ISO27001' && <ShieldCheck size={14} className="text-green-400" />}
                                                        <span className="font-semibold">{schedule.reportType}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="sm" variant="flat" color="secondary" className="capitalize">
                                                        {schedule.frequency}
                                                    </Chip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {schedule.recipients.map((email, i) => (
                                                            <Chip key={i} size="sm" variant="dot">{email}</Chip>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-foreground/60 text-xs">
                                                    {new Date(schedule.nextRunAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-foreground/60 text-xs">
                                                    {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button 
                                                        isIconOnly size="sm" color="danger" variant="light" 
                                                        onPress={() => setScheduleToDelete(schedule.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>
            </Tabs>

            {/* Create Schedule Modal */}
            <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Schedule Report</ModalHeader>
                            <ModalBody>
                                <Select 
                                    label="Report Type" 
                                    selectedKeys={[newSchedule.reportType]}
                                    onChange={(e) => setNewSchedule({...newSchedule, reportType: e.target.value})}
                                >
                                    <SelectItem key="SOC2">SOC 2 Type II</SelectItem>
                                    <SelectItem key="ISO27001">ISO 27001</SelectItem>
                                    <SelectItem key="NIST">NIST CSF</SelectItem>
                                    <SelectItem key="PDPA">Thai PDPA</SelectItem>
                                    <SelectItem key="AI_ACCURACY">AI Accuracy & ROI</SelectItem>
                                </Select>

                                <Select 
                                    label="Frequency" 
                                    selectedKeys={[newSchedule.frequency]}
                                    onChange={(e) => setNewSchedule({...newSchedule, frequency: e.target.value as any})}
                                >
                                    <SelectItem key="daily">Daily</SelectItem>
                                    <SelectItem key="weekly">Weekly</SelectItem>
                                    <SelectItem key="monthly">Monthly</SelectItem>
                                </Select>

                                <Input
                                    label="Recipients (Comma separated)"
                                    placeholder="admin@example.com, manager@example.com"
                                    value={newSchedule.recipients}
                                    onValueChange={(val) => setNewSchedule({...newSchedule, recipients: val})}
                                    startContent={<Mail size={16} className="text-default-400" />}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" isLoading={creating} onPress={handleCreateSchedule}>
                                    Create Schedule
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                <strong>Note:</strong> Reports are generated in real-time based on current system data. Large datasets may take a few seconds to process.
            </div>

            <ConfirmDialog 
                isOpen={!!scheduleToDelete}
                onClose={() => setScheduleToDelete(null)}
                onConfirm={confirmDeleteSchedule}
                title="Delete Schedule"
                description="Are you sure you want to delete this report schedule? This action cannot be undone."
                confirmLabel="Delete"
                confirmColor="danger"
                isLoading={deleting}
            />
        </div>
    );
}
