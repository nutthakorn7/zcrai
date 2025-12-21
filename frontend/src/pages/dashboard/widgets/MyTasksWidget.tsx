import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Spinner, ScrollShadow } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { AlertsAPI, Alert } from '../../../shared/api/alerts';
import { Icon } from '../../../shared/ui';

export function MyTasksWidget() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      // Fetch 'New' alerts (Unassigned Queue)
      // In a real scenario, we might sort by severity DESC
      const data = await AlertsAPI.list({ status: ['new'], limit: 10 });
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-danger';
      case 'high': return 'text-warning';
      case 'medium': return 'text-primary';
      case 'low': return 'text-success';
      default: return 'text-default-400';
    }
  };

    const getSeverityBg = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-danger/10 border-danger/20';
      case 'high': return 'bg-warning/10 border-warning/20';
      case 'medium': return 'bg-primary/10 border-primary/20';
      case 'low': return 'bg-success/10 border-success/20';
      default: return 'bg-default/10 border-default/20';
    }
  };

  return (
    <Card className="h-full bg-content1/50 border border-white/5 backdrop-blur-sm">
      <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Icon.Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Pending Triage</h3>
             <p className="text-xs text-foreground/50">Unassigned alerts requiring attention</p>
          </div>
        </div>
        <Chip size="sm" variant="flat" color="primary">
            {tasks.length} Pending
        </Chip>
      </CardHeader>
      <CardBody className="p-0">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Icon.CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h4 className="text-lg font-medium">All Caught Up!</h4>
            <p className="text-sm text-foreground/50 max-w-[200px]">
              There are no new alerts in the queue. Good job!
            </p>
          </div>
        ) : (
          <ScrollShadow className="h-[400px]">
             <div className="divide-y divide-white/5">
                {tasks.map((task) => (
                    <div 
                        key={task.id}
                        className="p-4 hover:bg-content2/50 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/detections?id=${task.id}`)}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBg(task.severity)} ${getSeverityColor(task.severity)}`}>
                                {task.severity}
                            </span>
                             <span className="text-xs text-foreground/40 font-mono">
                                {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                        <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                            {task.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-foreground/50">
                             <span>{task.source}</span>
                             <Icon.ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ))}
            </div>
          </ScrollShadow>
        )}
      </CardBody>
      <div className="p-4 border-t border-white/5 bg-white/5">
        <Button 
            className="w-full" 
            variant="flat" 
            color="primary" 
            onPress={() => navigate('/detections?status=new')}
        >
            View Queue
        </Button>
      </div>
    </Card>
  );
}
