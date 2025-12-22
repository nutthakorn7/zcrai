import { useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import { format } from 'date-fns';

interface TimelineEvent {
    id: string;
    timestamp: string; // ISO string from API
    type: 'ALERT' | 'LOG' | 'ACTION' | 'NOTE';
    title: string;
    severity?: string;
    metadata?: any;
}

interface InvestigationTimelineProps {
    events: TimelineEvent[];
    onEventClick?: (event: TimelineEvent) => void;
}

export function InvestigationTimeline({ events, onEventClick }: InvestigationTimelineProps) {
    if (!events || events.length === 0) return null;

    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [events]);

    return (
        <Card className="bg-content1/50 border border-white/5 w-full">
            <CardBody className="p-4 overflow-x-auto">
                <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Attack Timeline</h3>
                
                <div className="relative min-w-[600px] flex items-center justify-between py-6 px-4">
                    {/* Horizontal Line */ }
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-700 -z-0"></div>

                    {sortedEvents.map((ev) => {
                        const isAlert = ev.type === 'ALERT';
                        const color = isAlert ? 'bg-red-500' : ev.type === 'ACTION' ? 'bg-blue-500' : 'bg-gray-500';
                        
                        return (
                            <div 
                                key={ev.id} 
                                className="relative z-10 flex flex-col items-center group cursor-pointer"
                                onClick={() => onEventClick?.(ev)}
                            >
                                {/* Timestamp Top */}
                                <span className="absolute -top-8 text-[10px] text-gray-500 opacity-60 group-hover:opacity-100 whitespace-nowrap">
                                    {format(new Date(ev.timestamp), 'HH:mm:ss')}
                                </span>

                                {/* Dot Marker */}
                                <div className={`w-4 h-4 rounded-full ${color} border-2 border-[#1E1B4B] shadow transition-transform group-hover:scale-125`}></div>

                                {/* Title Bottom */}
                                <div className="absolute top-6 w-32 text-center">
                                    <div className="text-[10px] font-bold text-gray-300 truncate">{ev.title}</div>
                                    <div className="text-[9px] text-gray-500">{ev.type}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
}
