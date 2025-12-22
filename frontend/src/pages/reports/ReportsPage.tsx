import { useState } from 'react';
import { Card, CardBody, Button, Chip, Spinner } from "@heroui/react";
import { FileText, Download, ShieldCheck, Lock } from 'lucide-react';
import { api } from '../../lib/api';

export default function ReportsPage() {
    const [generating, setGenerating] = useState<string | null>(null);

    const handleDownload = async (type: 'SOC2' | 'ISO27001') => {
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        Compliance Reports
                    </h1>
                    <p className="text-gray-400">Generate audit-ready PDF reports for compliance standards.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <h3 className="text-xl font-bold">SOC 2 Type II Report</h3>
                            <p className="text-gray-400 text-sm mt-1">
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
                            <h3 className="text-xl font-bold">ISO 27001 Report</h3>
                            <p className="text-gray-400 text-sm mt-1">
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
            </div>
            
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                <strong>Note:</strong> Reports are generated in real-time based on current system data. Large datasets may take a few seconds to process.
            </div>
        </div>
    );
}
