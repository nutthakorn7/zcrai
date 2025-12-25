import { Button, Chip, Select, SelectItem, AvatarGroup, Tooltip, Avatar } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import { useNavigate } from "react-router-dom";

interface CaseHeaderProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseItem: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeUsers: any[];
    onGraphOpen: () => void;
    onSyncOpen: () => void;
    onExportPDF: () => void;
    exporting: boolean;
    onStatusChange: (status: string) => void;
}

export const CaseHeader = ({
    caseItem,
    activeUsers,
    onGraphOpen,
    onSyncOpen,
    onExportPDF,
    exporting,
    onStatusChange
}: CaseHeaderProps) => {
    const navigate = useNavigate();

    // SLA Helper Logic (Local to Header for display)
    const getSLAHours = (severity: string | undefined | null) => {
        if (!severity) return 24;
        switch(severity.toLowerCase()) {
            case 'critical': return 4;
            case 'high': return 8;
            case 'medium': return 24;
            case 'low': return 48;
            default: return 24;
        }
    };

    const createdAt = caseItem.createdAt || caseItem.created_at;
    const createdAtDate = createdAt ? new Date(createdAt) : null;
    const isValidDate = createdAtDate && !isNaN(createdAtDate.getTime());
    
    const slaDeadline = isValidDate 
        ? new Date(createdAtDate.getTime() + getSLAHours(caseItem.severity) * 60 * 60 * 1000)
        : null;
    
    const now = new Date();
    const timeLeftMs = slaDeadline ? slaDeadline.getTime() - now.getTime() : 0;
    const isBreached = slaDeadline ? timeLeftMs < 0 : false;
    
    const formatTimeLeft = (ms: number) => {
        if (!isFinite(ms) || isNaN(ms)) return 'N/A';
        const absMs = Math.abs(ms);
        const h = Math.floor(absMs / (1000 * 60 * 60));
        const m = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${h}h ${m}m`;
    };

    const formatDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleString();
    };

    return (
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-2 flex-1 w-full">
                <Button variant="light" size="sm" startContent={<Icon.ArrowLeft className="w-4 h-4"/>} onPress={() => navigate('/cases')} className="w-fit -ml-3">Back to Board</Button>
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold">{caseItem.title || 'Untitled Case'}</h1>
                    {caseItem.severity && <Chip color={caseItem.severity === 'critical' ? 'danger' : caseItem.severity === 'high' ? 'warning' : 'primary'}>{caseItem.severity}</Chip>}
                    
                    {slaDeadline && caseItem.status !== 'resolved' && caseItem.status !== 'closed' && (
                        <Chip 
                            variant="flat" 
                            color={isBreached ? "danger" : (timeLeftMs < 3600000 ? "warning" : "success")}
                            startContent={<Icon.Clock className="w-3 h-3" />}
                            className="font-mono"
                        >
                            {isBreached ? `Breached by ${formatTimeLeft(timeLeftMs)}` : `${formatTimeLeft(timeLeftMs)} remaining`}
                        </Chip>
                    )}
                </div>
                
                {/* Meta Row */}
                <div className="flex flex-wrap justify-between items-center w-full gap-y-2 text-gray-400 text-sm">
                    <div className="flex items-center gap-4">
                        <span>Created {formatDate(createdAt)}</span>
                        {caseItem.status && <span>• Status: {caseItem.status}</span>}
                    </div>
                    
                    {activeUsers.length > 0 && (
                            <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                            <span className="text-xs font-semibold text-success uppercase tracking-widest animate-pulse">LIVE</span>
                            <AvatarGroup isBordered max={4} size="sm">
                                {activeUsers.map(u => (
                                    <Tooltip key={u.id} content={u.name}>
                                        <Avatar name={u.name} />
                                    </Tooltip>
                                ))}
                            </AvatarGroup>
                            </div>
                    )}
                </div>
            </div>
            <div className="flex gap-2">
                    <Button color="secondary" variant="flat" startContent={<Icon.Global className="w-4 h-4" />} onPress={onGraphOpen}>
                    Graph View
                    </Button>
                    <Button variant="bordered" startContent={<Icon.Refresh className="w-4 h-4" />} onPress={onSyncOpen}>
                    Sync
                    </Button>
                    <Button 
                    variant="flat" 
                    startContent={!exporting && <Icon.Document className="w-4 h-4" />} 
                    isLoading={exporting}
                    onPress={onExportPDF}
                    >
                    Export PDF
                    </Button>
                    <Select 
                    aria-label="Status"
                    selectedKeys={[caseItem.status]} 
                    className="w-40" 
                    onChange={(e) => onStatusChange(e.target.value)}
                    >
                    <SelectItem key="open">Open</SelectItem>
                    <SelectItem key="investigating">Investigating</SelectItem>
                    <SelectItem key="resolved">Resolved</SelectItem>
                    <SelectItem key="closed">Closed</SelectItem>
                </Select>
            </div>
        </div>
    );
};
