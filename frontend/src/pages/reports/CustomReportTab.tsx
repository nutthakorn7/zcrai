import { useState } from 'react';
import { 
    Card, CardBody, Button, Select, SelectItem, 
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
    Chip, CheckboxGroup, Checkbox
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { DateRangePicker } from '../../components/DateRangePicker';
import { api } from '../../shared/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function CustomReportTab() {
    // Filters
    const [source, setSource] = useState("cases");
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)));
    const [endDate, setEndDate] = useState(new Date());
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    
    // Data
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any[]>([]);
    const [generated, setGenerated] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setGenerated(false);
        try {
            let endpoint = '';
            let params = new URLSearchParams();
            
            // Common params
            params.append('startDate', startDate.toISOString());
            params.append('endDate', endDate.toISOString());

            if (source === 'cases') {
                endpoint = '/cases';
                if (statusFilter.length > 0) params.append('status', statusFilter.join(','));
            } else if (source === 'alerts') {
                endpoint = '/alerts';
                // Alerts might filter by severity instead of status, but simplifying for now
                if (statusFilter.length > 0) params.append('severity', statusFilter.join(','));
            }

            // Fetch
            // Note: Adjust limit for reports
            params.append('limit', '100'); 
            
            const res = await api.get(`${endpoint}?${params.toString()}`);
            setReportData(res.data.data || []); // Assuming standard pagination response structure
            setGenerated(true);

        } catch (e) {
            console.error("Report generation failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const dateStr = new Date().toLocaleDateString();

        // Header
        doc.setFontSize(18);
        doc.text('Custom Security Report', 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${dateStr}`, 14, 28);
        doc.text(`Source: ${source === 'cases' ? 'Case Management' : 'Alert System'}`, 14, 33);
        doc.text(`Range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 14, 38);

        // Table
        const columns = source === 'cases' 
            ? ['ID', 'Title', 'Severity', 'Status', 'Assignee', 'Created']
            : ['ID', 'Title', 'Severity', 'Source', 'Status', 'Time'];

        const rows = reportData.map(item => {
            if (source === 'cases') {
                return [
                    item.id.slice(0, 8),
                    item.title,
                    item.severity,
                    item.status,
                    item.assignee?.name || 'Unassigned',
                    new Date(item.createdAt).toLocaleDateString()
                ];
            } else {
                return [
                    item.id.slice(0, 8),
                    item.title,
                    item.severity,
                    item.source,
                    item.status,
                    new Date(item.timestamp || item.created_at).toLocaleString()
                ];
            }
        });

        autoTable(doc as any, {
            startY: 45,
            head: [columns],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [63, 63, 70] },
            styles: { fontSize: 8 }
        });

        doc.save(`zcrAI_CustomReport_${source}_${Date.now()}.pdf`);
    };

    return (
        <div className="space-y-6 mt-4">
            <Card className="bg-content1/50 border border-white/5 p-4">
                <CardBody className="gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Data Source */}
                        <Select 
                            label="Data Source" 
                            selectedKeys={[source]} 
                            onChange={(e) => setSource(e.target.value)}
                        >
                            <SelectItem key="cases">Cases</SelectItem>
                            <SelectItem key="alerts">Alerts</SelectItem>
                        </Select>

                        {/* Date Range */}
                        <div className="flex flex-col gap-2">
                             <span className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Date Range</span>
                             <DateRangePicker 
                                startDate={startDate} 
                                endDate={endDate} 
                                onChange={(s, e) => { setStartDate(s); setEndDate(e); }} 
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-2">
                           <span className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">
                                {source === 'cases' ? 'Status' : 'Severity'}
                           </span>
                           {source === 'cases' ? (
                               <CheckboxGroup 
                                    orientation="horizontal" 
                                    value={statusFilter} 
                                    onValueChange={setStatusFilter}
                                    classNames={{ wrapper: "gap-4" }}
                                >
                                   <Checkbox value="open" size="sm">Open</Checkbox>
                                   <Checkbox value="closed" size="sm">Closed</Checkbox>
                               </CheckboxGroup>
                           ) : (
                               <CheckboxGroup 
                                    orientation="horizontal" 
                                    value={statusFilter} 
                                    onValueChange={setStatusFilter}
                                    color="warning"
                                    classNames={{ wrapper: "gap-4" }}
                                >
                                   <Checkbox value="critical" size="sm" color="danger">Critical</Checkbox>
                                   <Checkbox value="high" size="sm" color="warning">High</Checkbox>
                                   <Checkbox value="medium" size="sm" color="warning">Medium</Checkbox>
                               </CheckboxGroup>
                           )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button 
                            color="primary" 
                            onPress={handleGenerate} 
                            isLoading={loading}
                            startContent={!loading && <Icon.Search className="w-4 h-4"/>}
                        >
                            Generate Report
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Results Area */}
            {generated && (
                <div className="animate-fade-in space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold font-display tracking-tight">Results ({reportData.length})</h3>
                        <Button 
                            color="secondary" 
                            variant="flat" 
                            startContent={<Icon.Document className="w-4 h-4"/>}
                            onPress={handleExportPDF}
                            isDisabled={reportData.length === 0}
                        >
                            Export PDF
                        </Button>
                    </div>

                    <Table aria-label="Report Data Table">
                        <TableHeader>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">ID</TableColumn>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">TITLE</TableColumn>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">SEVERITY</TableColumn>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">{source === 'cases' ? 'ASSIGNEE' : 'SOURCE'}</TableColumn>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">STATUS</TableColumn>
                            <TableColumn className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">DATE</TableColumn>
                        </TableHeader>
                        <TableBody items={reportData} emptyContent="No data found matching filters.">
                            {(item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                                    <TableCell>
                                        <div className="truncate max-w-[200px] font-medium">{item.title}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            size="sm" 
                                            color={
                                                ['critical', 'high'].includes((item.severity || '').toLowerCase()) ? 'danger' : 
                                                ['medium'].includes((item.severity || '').toLowerCase()) ? 'warning' : 'primary'
                                            } 
                                            variant="flat"
                                        >
                                            {item.severity}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        {source === 'cases' ? (
                                            item.assignee?.name || <span className="text-default-400">Unassigned</span>
                                        ) : (
                                            <span className="capitalize">{item.source}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="dot" color={item.status === 'closed' ? 'success' : 'warning'}>
                                            {item.status}
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {new Date(item.timestamp || item.createdAt || item.created_at).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
