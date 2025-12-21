import { useState } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Tabs, Tab
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { ThreatIntelAPI } from '../../shared/api/threat-intel';

export default function ThreatIntelPage() {
  const [activeTab, setActiveTab] = useState('reputation'); // 'reputation' | 'retro'
  
  // Common State
  const [type, setType] = useState<'ip' | 'hash' | 'domain'>('ip');
  const [value, setValue] = useState('');
  
  // Retro Scan State
  const [days, setDays] = useState('90');
  const [retroResult, setRetroResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Reputation State
  const [repResult, setRepResult] = useState<any>(null);
  const [isLookup, setIsLookup] = useState(false);

  const handleScan = async () => {
    if (!value) return;
    try {
      if (activeTab === 'retro') {
          setIsScanning(true);
          const data = await ThreatIntelAPI.retroScan(type, value, parseInt(days));
          setRetroResult(data);
      } else {
          setIsLookup(true);
          const data = await ThreatIntelAPI.lookup(type, value);
          setRepResult(data);
      }
    } catch (e) {
      console.error(e);
      alert('Operation failed');
    } finally {
      setIsScanning(false);
      setIsLookup(false);
    }
  };

  return (
    <div className="p-6 h-screen overflow-y-auto animate-fade-in">
        <div className="mb-8">
           <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon.Shield className="w-6 h-6 text-primary"/> 
             Threat Intelligence
           </h1>
           <p className="text-foreground/60 text-sm mt-1">Retroactive IOC Scanning. Search past logs for newly discovered threats.</p>
        </div>

        <div className="flex flex-col gap-6">
            <Tabs 
                aria-label="Threat Intel Options" 
                color="primary" 
                variant="underlined"
                selectedKey={activeTab}
                onSelectionChange={(k) => setActiveTab(k as string)}
            >
                <Tab key="reputation" title="External Reputation (VirusTotal)" />
                <Tab key="retro" title="Internal Retro-Scan" />
            </Tabs>

            <Card className="bg-white/5 border border-white/5">
                <CardBody className="flex flex-row gap-4 items-end p-6">
                    <Select label="IOC Type" className="w-40" selectedKeys={[type]} onChange={(e) => setType(e.target.value as any)}>
                        <SelectItem key="ip">IP Address</SelectItem>
                        <SelectItem key="hash">File Hash</SelectItem>
                        <SelectItem key="domain">Domain</SelectItem>
                    </Select>
                    <Input 
                        className="flex-1" 
                        label="Value" 
                        placeholder={type === 'ip' ? "1.2.3.4" : "SHA256 / MD5 ..."}
                        value={value}
                        onValueChange={setValue}
                    />
                    
                    {activeTab === 'retro' && (
                        <Select label="Time Range" className="w-40" selectedKeys={[days]} onChange={(e) => setDays(e.target.value)}>
                            <SelectItem key="7">Last 7 Days</SelectItem>
                            <SelectItem key="30">Last 30 Days</SelectItem>
                            <SelectItem key="90">Last 90 Days</SelectItem>
                            <SelectItem key="365">Last 1 Year</SelectItem>
                        </Select>
                    )}

                    <Button 
                        color="primary" 
                        onPress={handleScan} 
                        isLoading={isScanning || isLookup} 
                        startContent={!(isScanning || isLookup) && <Icon.Search className="w-4 h-4"/>}
                    >
                        {activeTab === 'retro' ? 'Scan Internal Logs' : 'Check Reputation'}
                    </Button>
                </CardBody>
            </Card>

            {/* Reputation Results */}
            {activeTab === 'reputation' && repResult && (
                <div className="animate-fade-in flex flex-col gap-4">
                     {/* Verdict Card */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-white/5 border border-white/5">
                            <CardBody>
                                <div className="text-sm text-foreground/60">Verdict</div>
                                <div className={`text-2xl font-bold ${
                                    repResult.verdict === 'malicious' ? 'text-danger' : 
                                    repResult.verdict === 'suspicious' ? 'text-warning' : 'text-success'
                                }`}>
                                    {repResult.verdict?.toUpperCase()}
                                </div>
                            </CardBody>
                        </Card>
                         <Card className="bg-white/5 border border-white/5">
                            <CardBody>
                                <div className="text-sm text-foreground/60">Confidence Score</div>
                                <div className="text-2xl font-bold">{repResult.confidenceScore}%</div>
                            </CardBody>
                        </Card>
                        <Card className="bg-white/5 border border-white/5">
                            <CardBody>
                                <div className="text-sm text-foreground/60">Malware Families</div>
                                <div className="flex gap-2 flex-wrap mt-1">
                                    {repResult.malwareFamilies?.length > 0 ? (
                                        repResult.malwareFamilies.map((f: string) => <Chip key={f} size="sm" color="danger" variant="flat">{f}</Chip>)
                                    ) : (
                                        <span className="text-gray-500 text-sm">-</span>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                     </div>

                     {/* Sources Table */}
                     <Card className="bg-white/5 border border-white/5">
                        <CardBody className="p-0">
                             <Table removeWrapper aria-label="Sources table" className="bg-transparent">
                                <TableHeader>
                                    <TableColumn>SOURCE</TableColumn>
                                    <TableColumn>STATUS</TableColumn>
                                    <TableColumn>RISK</TableColumn>
                                </TableHeader>
                                <TableBody>
                                    {repResult.sources.map((s: any, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell>
                                                {s.found ? <Icon.CheckCircle className="text-danger w-5 h-5"/> : <Icon.CheckCircle className="text-success w-5 h-5"/>}
                                            </TableCell>
                                            <TableCell>
                                                 <Chip size="sm" color={s.risk === 'malicious' ? 'danger' : s.risk === 'suspicious' ? 'warning' : 'success'} variant="flat">
                                                    {s.risk.toUpperCase()}
                                                 </Chip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                        </CardBody>
                     </Card>
                </div>
            )}

            {/* Retro Results */}
            {activeTab === 'retro' && retroResult && (
                <div className="animate-fade-in">
                    <div className="flex gap-4 mb-4">
                        <Card className="flex-1 bg-white/5 border border-white/5">
                            <CardBody>
                                <div className="text-sm text-foreground/60">Status</div>
                                <div className={`text-xl font-bold ${retroResult.found ? 'text-danger' : 'text-success'}`}>
                                    {retroResult.found ? 'THREAT FOUND' : 'CLEAN'}
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="flex-1 bg-white/5 border border-white/5">
                            <CardBody>
                                <div className="text-sm text-foreground/60">Matches</div>
                                <div className="text-xl font-bold">{retroResult.count}</div>
                            </CardBody>
                        </Card>
                    </div>

                    {retroResult.found && (
                        <Card className="bg-white/5 border border-white/5">
                            <CardBody className="p-0">
                                <Table removeWrapper aria-label="Matches table" className="bg-transparent">
                                    <TableHeader>
                                        <TableColumn>TIMESTAMP</TableColumn>
                                        <TableColumn>HOST</TableColumn>
                                        <TableColumn>SOURCE</TableColumn>
                                        <TableColumn>DETAILS</TableColumn>
                                    </TableHeader>
                                    <TableBody>
                                        {retroResult.matches.map((match: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell>{new Date(match.timestamp).toLocaleString()}</TableCell>
                                                <TableCell>{match.host_name} ({match.host_ip})</TableCell>
                                                <TableCell><Chip size="sm" variant="flat">{match.source}</Chip></TableCell>
                                                <TableCell>
                                                    <div className="text-xs font-mono max-w-lg truncate">
                                                        {type === 'hash' ? (match.file_hash || match.process_sha256) : 
                                                         type === 'domain' ? (match.host_domain || match.user_domain) :
                                                         (match.network_src_ip || match.network_dst_ip)}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
