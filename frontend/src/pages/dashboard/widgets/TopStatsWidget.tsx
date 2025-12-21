import { useState } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Chip, ScrollShadow } from '@heroui/react';
import { Icon } from '../../../shared/ui';
import { ActiveThreatsWidget } from './ActiveThreatsWidget';

interface TopStatsWidgetProps {
    topHosts: any[];
    topUsers: any[];
}

export function TopStatsWidget({ topHosts, topUsers }: TopStatsWidgetProps) {
    const [selectedTab, setSelectedTab] = useState<'hosts'|'users'|'threats'>('hosts');

    return (
        <Card className="h-full bg-content1/50 border border-white/5 backdrop-blur-sm flex flex-col">
            <CardHeader className="px-4 py-3 border-b border-white/5 shrink-0 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                     {selectedTab === 'hosts' && <Icon.Server className="w-4 h-4 text-secondary"/>}
                     {selectedTab === 'users' && <Icon.Users className="w-4 h-4 text-warning"/>}
                     {selectedTab === 'threats' && <Icon.ShieldAlert className="w-4 h-4 text-danger"/>}
                     <span className="font-semibold text-sm">
                        {selectedTab === 'hosts' ? 'Top Risky Hosts' : selectedTab === 'users' ? 'Top Risky Users' : 'Active Threats'}
                     </span>
                </div>
                 <Tabs 
                    size="sm" 
                    aria-label="Stats Type" 
                    selectedKey={selectedTab} 
                    onSelectionChange={(k) => setSelectedTab(k as any)}
                    className="justify-end"
                >
                    <Tab key="hosts" title={<Icon.Server className="w-4 h-4"/>} />
                    <Tab key="users" title={<Icon.Users className="w-4 h-4"/>} />
                    <Tab key="threats" title={<Icon.ShieldAlert className="w-4 h-4"/>} />
                </Tabs>
            </CardHeader>
            <CardBody className="p-0 flex-1 overflow-hidden">
                {selectedTab === 'threats' ? (
                     <div className="h-full p-0">
                        {/* Reuse ActiveThreatsWidget content logic or wrap it */}
                        {/* Since ActiveThreatsWidget is a Card, we might need to extract its Body if we want to nest it perfectly, 
                            or just render it here. But ActiveThreatsWidget has its own Card wrapper. 
                            I will just use ActiveThreatsWidget but I need to strip the Card wrapper logic or make it adaptable.
                            Actually, simpler: Just duplicate the render logic or import a headless version.
                            I will try to just render ActiveThreatsWidget and accept double borders or refactor ActiveThreatsWidget to be headless.
                            
                            Better: I will refactor ActiveThreatsWidget to be headless in next step. For now I will inline the threat logic here or just import the widget and let it render inside (it might look nested).
                            
                            Actually, I will just render the ActiveThreatsWidget as a child. It has h-full.
                        */}
                        <ActiveThreatsWidget />
                     </div>
                ) : (
                    <ScrollShadow className="h-full p-4">
                        <div className="space-y-3">
                            {(selectedTab === 'hosts' ? topHosts : topUsers).map((item, i) => (
                                <div 
                                    key={i} 
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[10px] font-bold text-foreground/50">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-foreground block truncate max-w-[150px]">
                                                {selectedTab === 'hosts' ? item.host_name : item.user_name}
                                            </span>
                                            <span className="text-[10px] text-default-400 font-mono">
                                                {item.count} Alerts
                                            </span>
                                        </div>
                                    </div>
                                    {parseInt(item.critical) > 0 && (
                                        <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] px-1">
                                            {item.critical} Crit
                                        </Chip>
                                    )}
                                </div>
                            ))}
                             {(selectedTab === 'hosts' ? topHosts : topUsers).length === 0 && (
                                <div className="flex flex-col items-center justify-center h-40 text-default-400 gap-2">
                                    <p className="text-xs">No data available</p>
                                </div>
                             )}
                        </div>
                    </ScrollShadow>
                )}
            </CardBody>
        </Card>
    );
}
