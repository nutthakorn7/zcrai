import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody, Avatar, Spinner } from '@heroui/react';
import { api } from '../../../shared/api/api';
import { Icon } from '../../../shared/ui';

interface Activity {
  id: string;
  type: 'alert' | 'case_history' | 'comment';
  source: 'ai' | 'user' | 'system';
  title: string;
  description: string;
  timestamp: string;
  metadata: any;
}

export function RecentActivityWidget() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const res = await api.get('/dashboard/activity?limit=10');
      if (res.data) {
        setActivities(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch activity', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000); // minutes

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const renderIcon = (activity: Activity) => {
    if (activity.source === 'ai') {
        return (
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Icon.Cpu className="w-4 h-4 text-purple-400" />
            </div>
        );
    }
    if (activity.type === 'alert') {
        return (
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <Icon.Alert className="w-4 h-4 text-red-500" />
            </div>
        );
    }
    if (activity.metadata?.user) {
         return (
             <Avatar 
                name={activity.metadata.user.email} 
                className="w-8 h-8 text-xs" 
                src={activity.metadata.user.avatarUrl} // Assuming avatarUrl exists or fallback to name
             />
         );
    }
    return <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center"><Icon.Info className="w-4 h-4" /></div>;
  };

  return (
    <Card className="h-full bg-content2/50 border border-white/5">
      <CardHeader className="flex justify-between items-center px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <div className="font-semibold text-sm">Live Activity Feed</div>
        </div>
        {loading && <Spinner size="sm" />}
      </CardHeader>
      <CardBody className="p-0 overflow-y-auto max-h-[400px] scrollbar-hide">
        <div className="divide-y divide-white/5">
            {activities.map((item) => (
                <div key={item.id} className="p-3 hover:bg-white/5 transition-colors flex gap-3 text-sm">
                    <div className="mt-0.5">{renderIcon(item)}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <span className="font-medium text-foreground/90 truncate pr-2">
                                {item.source === 'ai' && <span className="text-purple-400 font-bold mr-1">AI:</span>}
                                {item.title}
                            </span>
                            <span className="text-xs text-foreground/40 whitespace-nowrap">{formatTime(item.timestamp)}</span>
                        </div>
                        <p className="text-foreground/60 text-xs mt-0.5 line-clamp-2">{item.description}</p>
                    </div>
                </div>
            ))}
            {!loading && activities.length === 0 && (
                <div className="text-center py-8 text-foreground/40 text-sm">No recent activity</div>
            )}
        </div>
      </CardBody>
    </Card>
  );
}
