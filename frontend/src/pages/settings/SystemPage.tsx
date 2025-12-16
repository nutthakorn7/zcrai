import { useState, useEffect } from 'react';
import { 
  Card, CardBody, Button, Input, 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Tabs, Tab
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { SystemAPI, BackupFile, LicenseInfo } from '../../shared/api/system';

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState('backups');
  return (
    <div className="p-6 h-screen overflow-y-auto animate-fade-in">
        <div className="mb-8">
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <Icon.Server className="w-6 h-6 text-primary"/> 
             System Management
           </h1>
           <p className="text-foreground/60 text-sm mt-1">Manage system backups and enterprise licensing.</p>
        </div>

        <Tabs aria-label="System Tabs" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
            <Tab key="backups" title="Backups">
                <BackupView />
            </Tab>
            <Tab key="license" title="License">
                <LicenseView />
            </Tab>
        </Tabs>
    </div>
  );
}

function BackupView() {
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    const loadBackups = async () => {
        try {
            setIsLoading(true);
            const data = await SystemAPI.getBackups();
            setBackups(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBackups();
    }, []);

    const handleBackup = async () => {
        try {
            setIsBackingUp(true);
            await SystemAPI.triggerBackup();
            alert('Backup started');
            loadBackups(); // Refresh list (might need delay/polling in real implementation)
        } catch (e) {
            alert('Backup failed');
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="mt-4">
            <div className="flex justify-end mb-4">
                <Button 
                    color="primary" 
                    startContent={<Icon.Download className="w-4 h-4"/>}
                    onPress={handleBackup}
                    isLoading={isBackingUp}
                >
                    Trigger Backup
                </Button>
            </div>
            
            <Card className="bg-white/5 border border-white/5">
                <CardBody className="p-0">
                    <Table aria-label="Backups table" className="bg-transparent" removeWrapper>
                        <TableHeader>
                            <TableColumn>FILENAME</TableColumn>
                            <TableColumn>SIZE</TableColumn>
                            <TableColumn>CREATED AT</TableColumn>
                            <TableColumn>ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={"No backups found."} isLoading={isLoading}>
                            {backups.map((file) => (
                                <TableRow key={file.name}>
                                    <TableCell>{file.name}</TableCell>
                                    <TableCell>{(file.size / 1024 / 1024).toFixed(2)} MB</TableCell>
                                    <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="flat" isIconOnly>
                                            <Icon.Download className="w-4 h-4"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>
        </div>
    );
}

function LicenseView() {
    const [info, setInfo] = useState<LicenseInfo | null>(null);
    const [key, setKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadLicense = async () => {
        try {
            const data = await SystemAPI.getLicense();
            setInfo(data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        loadLicense();
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await SystemAPI.updateLicense(key);
            setKey('');
            loadLicense();
            alert('License updated');
        } catch (e) {
            alert('Failed to update license');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mt-4 max-w-2xl">
            <Card className="mb-6 bg-white/5 border border-white/5">
                <CardBody className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Current License</h3>
                        <Chip color={info?.status === 'active' ? 'success' : 'danger'}>
                            {info?.status?.toUpperCase() || 'UNKNOWN'}
                        </Chip>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-black/20">
                            <div className="text-xs text-foreground/60 mb-1">Max Users</div>
                            <div className="text-2xl font-bold">{info?.users || '-'}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-black/20">
                            <div className="text-xs text-foreground/60 mb-1">Log Retention</div>
                            <div className="text-2xl font-bold">{info?.retention || '-'} Days</div>
                        </div>
                        <div className="col-span-2 p-4 rounded-lg bg-black/20">
                            <div className="text-xs text-foreground/60 mb-1">License Key</div>
                            <div className="font-mono">{info?.key || 'No License Key'}</div>
                        </div>
                        <div className="col-span-2 text-right text-xs text-foreground/60">
                            Expires: {info?.expiresAt}
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="bg-white/5 border border-white/5">
                <CardBody className="p-6">
                    <h3 className="text-lg font-bold mb-4">Update License</h3>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Paste new license key..." 
                            value={key}
                            onValueChange={setKey}
                        />
                        <Button color="primary" onPress={handleSave} isLoading={isSaving}>
                            Activate
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
