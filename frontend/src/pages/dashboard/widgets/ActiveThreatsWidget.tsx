import { useEffect, useState } from 'react';
import { Progress, Spinner } from '@heroui/react';
import { api } from '../../../shared/api';
import { Icon } from '../../../shared/ui';

interface ThreatTag {
    tag: string;
    count: number;
}

export function ActiveThreatsWidget() {
    const [tags, setTags] = useState<ThreatTag[]>([]);
    const [maliciousCount, setMaliciousCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const res = await api.get('/threat-intel/summary');
            if (res.data) {
                setTags(res.data.topTags || []);
                setMaliciousCount(res.data.maliciousCount || 0);
            }
        } catch (error) {
            console.error('Failed to load threat intel:', error);
        } finally {
            setLoading(false);
        }
    };

    const maxCount = Math.max(...tags.map(t => t.count), 1);

    return (
        <div className="h-full w-full p-4 overflow-y-auto no-scrollbar">
            {loading ? (
                <div className="flex bg-transparent h-full items-center justify-center">
                    <Spinner size="sm" />
                </div>
            ) : tags.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-foreground/40 text-xs">
                    <Icon.ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                    <p>No active threats detected</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tags.slice(0, 5).map((item) => (
                        <div key={item.tag} className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium truncate max-w-[150px]">{item.tag}</span>
                                <span className="text-foreground/50">{item.count}</span>
                            </div>
                            <Progress 
                                size="sm" 
                                value={(item.count / maxCount) * 100} 
                                color="danger" 
                                className="max-w-full"
                            />
                        </div>
                    ))}
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs text-foreground/50">
                        <span>Total Malicious Events</span>
                        <span className="text-danger font-mono font-bold">{maliciousCount}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
