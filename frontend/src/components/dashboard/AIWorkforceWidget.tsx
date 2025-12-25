import { Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { useEffect, useState } from "react";
import { Icon } from "../../shared/ui";
import { api } from '../../shared/api';

export function AIWorkforceWidget() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await api.get('/feedback/stats');
            if(res.data.success) {
                setStats(res.data.data);
            }
        } catch (error) {
            console.error("Failed to load AI stats", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <Card className="h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-white/5">
                <CardBody className="p-6">
                    <Skeleton className="rounded-lg h-8 w-1/2 mb-4" />
                    <Skeleton className="rounded-lg h-24 w-full" />
                </CardBody>
            </Card>
        );
    }

    // Default to zero if stats failed
    const { totalTriageCount = 0, totalHoursSaved = 0, costSavings = 0, accuracyRate = 0 } = stats || {};

    return (
        <Card className="h-full bg-gradient-to-br from-[#1E1B4B] to-[#172554] border border-white/10 shadow-xl overflow-hidden relative group">
             {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon.Cpu className="w-32 h-32 text-purple-400" />
            </div>

            <CardBody className="p-6 flex flex-col justify-between h-full relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                         <Chip size="sm" color="warning" variant="flat" className="text-[10px] uppercase font-bold tracking-wider">
                            AI Workforce
                        </Chip>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-6">Return on Investment</h3>
                
                    <div className="grid grid-cols-2 gap-6">
                         <div>
                            <p className="text-xs text-blue-200/60 uppercase font-bold tracking-wider mb-1">Hours Saved</p>
                            <p className="text-3xl font-black text-white flex items-end gap-1">
                                {totalHoursSaved} <span className="text-sm font-medium text-white/40 mb-1">hrs</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-green-200/60 uppercase font-bold tracking-wider mb-1">Cost Savings</p>
                            <p className="text-3xl font-black text-green-400 flex items-end gap-1">
                                ${costSavings.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-purple-200/60 uppercase font-bold tracking-wider mb-1">Total Triaged</p>
                             <p className="text-2xl font-bold text-white">{totalTriageCount}</p>
                        </div>
                         <div>
                            <p className="text-xs text-orange-200/60 uppercase font-bold tracking-wider mb-1">Accuracy</p>
                             <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold text-white">{accuracyRate}%</p>
                                <div className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden min-w-[50px]">
                                    <div className="h-full bg-gradient-to-r from-orange-400 to-red-400" style={{ width: `${accuracyRate}%` }} />
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
