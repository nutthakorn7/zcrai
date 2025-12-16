import { useState } from 'react';
import { 
  Card, CardBody, Button, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip
} from "@heroui/react";
import { Icon } from '../../shared/ui';
import { ThreatIntelAPI } from '../../shared/api/threat-intel';

export default function ThreatIntelPage() {
  const [type, setType] = useState<'ip' | 'hash' | 'domain'>('ip');
  const [value, setValue] = useState('');
  const [days, setDays] = useState('90');
  const [result, setResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    if (!value) return;
    try {
      setIsScanning(true);
      const data = await ThreatIntelAPI.retroScan(type, value, parseInt(days));
      setResult(data);
    } catch (e) {
      console.error(e);
      alert('Scan failed');
    } finally {
      setIsScanning(false);
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

        <Card className="mb-6 bg-white/5 border border-white/5">
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
                <Select label="Time Range" className="w-40" selectedKeys={[days]} onChange={(e) => setDays(e.target.value)}>
                    <SelectItem key="7">Last 7 Days</SelectItem>
                    <SelectItem key="30">Last 30 Days</SelectItem>
                    <SelectItem key="90">Last 90 Days</SelectItem>
                    <SelectItem key="365">Last 1 Year</SelectItem>
                </Select>
                <Button color="primary" onPress={handleScan} isLoading={isScanning} startContent={!isScanning && <Icon.Search className="w-4 h-4"/>}>
                    Scan History
                </Button>
            </CardBody>
        </Card>

        {result && (
            <div className="animate-fade-in">
                <div className="flex gap-4 mb-4">
                    <Card className="flex-1 bg-white/5 border border-white/5">
                        <CardBody>
                            <div className="text-sm text-foreground/60">Status</div>
                            <div className={`text-xl font-bold ${result.found ? 'text-danger' : 'text-success'}`}>
                                {result.found ? 'THREAT FOUND' : 'CLEAN'}
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="flex-1 bg-white/5 border border-white/5">
                        <CardBody>
                            <div className="text-sm text-foreground/60">Matches</div>
                            <div className="text-xl font-bold">{result.count}</div>
                        </CardBody>
                    </Card>
                </div>

                {result.found && (
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
                                    {result.matches.map((match: any, i: number) => (
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
  );
}
