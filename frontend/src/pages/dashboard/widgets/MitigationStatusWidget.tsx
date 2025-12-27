import { useEffect, useState } from 'react';
import { Card, CardBody } from "@heroui/react";
import { Icon } from '../../../shared/ui';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardAPI } from '../../../shared/api/dashboard';

export function MitigationStatusWidget() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await DashboardAPI.getMitigationStats(7); // Default 7 days
            if (res.data) {
                setStats(res.data);
            }
        } catch (error) {
            console.error('Failed to load mitigation stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    const data = [
        { name: 'Mitigated', value: stats?.mitigated || 0, color: '#10B981' }, // Green
        { name: 'Active', value: stats?.not_mitigated || 0, color: '#EF4444' }, // Red
        // Filter out unknown if 0 to keep chart clean
        ...(stats?.unknown ? [{ name: 'Unknown', value: stats.unknown, color: '#71717a' }] : [])
    ];

    const total = (stats?.mitigated || 0) + (stats?.not_mitigated || 0) + (stats?.unknown || 0);

    // Handle initial empty state
    if (!stats || total === 0) {
        return (
            <Card className="bg-content1/50 border border-white/5 backdrop-blur-sm h-full min-h-[140px]">
                <CardBody className="p-4 flex flex-col items-center justify-center text-center">
                     <div className="p-2 rounded-full bg-white/5 mb-2">
                        <Icon.Shield className="w-5 h-5 text-foreground/50" />
                     </div>
                     <p className="text-sm font-medium text-foreground/70">Threat Status</p>
                     <p className="text-xs text-foreground/40 mt-1">No threads detected</p>
                </CardBody>
            </Card>
        );
    }

    const mitigationRate = total > 0 ? Math.round((stats.mitigated / total) * 100) : 0;

    return (
        <Card className="bg-content1/50 border border-white/5 backdrop-blur-sm h-full">
            <CardBody className="p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Icon.Shield className="w-24 h-24 -rotate-12" />
                </div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p className="text-sm text-default-600 font-medium uppercase tracking-wider">Metric: Mitigation Rate</p>
                        <div className="flex items-baseline gap-2 mt-1">
                             <h3 className="text-3xl font-bold text-foreground">
                                {mitigationRate}%
                            </h3>
                            <span className="text-xs text-foreground/50 font-mono">
                                ({stats?.mitigated}/{total})
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                     <div className="h-[60px] w-[60px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={20}
                                    outerRadius={28}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                     </div>
                     <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-2 text-xs">
                             <div className="w-2 h-2 rounded-full bg-green-500" />
                             <span className="text-foreground/70">Mitigated ({stats?.mitigated ?? 0})</span>
                         </div>
                         <div className="flex items-center gap-2 text-xs">
                             <div className="w-2 h-2 rounded-full bg-red-500" />
                             <span className="text-foreground/70">Active ({stats?.not_mitigated ?? 0})</span>
                         </div>
                     </div>
                </div>
            </CardBody>
        </Card>
    );
}
