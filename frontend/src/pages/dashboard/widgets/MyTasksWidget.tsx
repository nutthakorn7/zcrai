import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Spinner, ScrollShadow, Tabs, Tab } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { AlertsAPI, Alert } from '../../../shared/api/alerts';
import { CasesAPI, Case } from '../../../shared/api/cases';
import { Icon } from '../../../shared/ui';
import { useAuth } from '../../../shared/store/useAuth';

export function MyTasksWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'alerts' | 'cases'>('alerts');
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fail safely if APIs fail
        const [alertsData, casesData] = await Promise.allSettled([
          AlertsAPI.list({ status: ['new'], limit: 10 }),
          user?.id ? CasesAPI.list({ assigneeId: user.id, status: 'open,investigating' }) : Promise.resolve([])
        ]);

        if (alertsData.status === 'fulfilled') setAlerts(alertsData.value);
        if (casesData.status === 'fulfilled') setCases(casesData.value);
        
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user]);

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
    <Card className="h-full bg-content1/50 border border-white/5 backdrop-blur-sm flex flex-col">
      <CardHeader className="flexjustify-between items-center px-6 pt-4 pb-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3 w-full">
            <div className="flex-1">
                 <h3 className="text-lg font-semibold text-foreground">My Workspace</h3>
                 <p className="text-xs text-foreground/50">Your active items</p>
            </div>
             <Tabs 
                size="sm" 
                aria-label="Task Types" 
                selectedKey={activeTab} 
                onSelectionChange={(k) => setActiveTab(k as any)}
                className="justify-end"
            >
                <Tab key="alerts" title={
                    <div className="flex items-center gap-2">
                        <Icon.Bell className="w-3 h-3"/>
                        <span>Queue</span>
                        <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px] px-1">{alerts.length}</Chip>
                    </div>
                }/>
                <Tab key="cases" title={
                     <div className="flex items-center gap-2">
                        <Icon.Briefcase className="w-3 h-3"/>
                        <span>Cases</span>
                        <Chip size="sm" variant="flat" color="warning" className="h-5 text-[10px] px-1">{cases.length}</Chip>
                    </div>
                }/>
            </Tabs>
        </div>
      </CardHeader>
      <CardBody className="p-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <ScrollShadow className="h-full">
             <div className="divide-y divide-white/5">
                {activeTab === 'alerts' ? (
                    alerts.length === 0 ? <EmptyState label="No Pending Alerts" /> : alerts.map((task) => (
                        <div 
                            key={task.id}
                            className="p-4 hover:bg-content2/50 cursor-pointer transition-colors group"
                            onClick={() => navigate(`/detections?id=${task.id}`)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBg(task.severity)} ${getSeverityColor(task.severity)}`}>
                                    {task.severity}
                                </span>
                                <span className="text-xs text-foreground/50 font-mono">
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
                    ))
                ) : (
                    cases.length === 0 ? <EmptyState label="No Assigned Cases" /> : cases.map((c) => (
                        <div 
                            key={c.id}
                            className="p-4 hover:bg-content2/50 cursor-pointer transition-colors group"
                            onClick={() => navigate(`/cases/${c.id}`)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBg(c.priority === 'P1' ? 'critical' : c.priority === 'P2' ? 'high' : 'medium')} ${getSeverityColor(c.priority === 'P1' ? 'critical' : c.priority === 'P2' ? 'high' : 'medium')}`}>
                                    {c.priority}
                                </span>
                                <span className="text-xs text-foreground/50 font-mono">
                                    {new Date(c.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                            <h4 className="font-medium text-foreground group-hover:text-warning transition-colors line-clamp-1 mb-1">
                                {c.title}
                            </h4>
                             <div className="flex items-center justify-between text-xs text-foreground/50">
                                <span className="capitalize">{c.status}</span>
                                <Icon.ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))
                )}
            </div>
          </ScrollShadow>
        )}
      </CardBody>
      <div className="p-3 border-t border-white/5 bg-white/5 shrink-0">
        <Button 
            className="w-full" 
            size="sm"
            variant="flat" 
            color={activeTab === 'cases' ? 'warning' : 'primary'}
            onPress={() => navigate(activeTab === 'cases' ? '/cases' : '/detections?status=new')}
        >
            View All {activeTab === 'cases' ? 'Cases' : 'Alerts'}
        </Button>
      </div>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-foreground/50">
            <Icon.CheckCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>{label}</p>
        </div>
    )
}
