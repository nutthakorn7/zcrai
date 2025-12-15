import { Icon } from "../../shared/ui";
import { CommentCard } from "./CommentCard";

interface TimelineItem {
  id: string;
  type: 'comment' | 'history';
  date: Date;
  data: any;
}

interface ActivityTimelineProps {
  comments: any[];
  history: any[];
  currentUserEmail: string;
  onEditComment: (id: string, content: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}

function SystemEvent({ event }: { event: any }) {
  const getIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('create')) return <Icon.Add className="w-4 h-4 text-success" />;
    if (act.includes('status')) return <Icon.Refresh className="w-4 h-4 text-warning" />;
    if (act.includes('assign')) return <Icon.User className="w-4 h-4 text-primary" />;
    if (act.includes('severity')) return <Icon.Alert className="w-4 h-4 text-danger" />;
    return <Icon.Info className="w-4 h-4 text-default" />;
  };

  return (
    <div className="flex gap-3 items-center py-2 px-4 opacity-70 hover:opacity-100 transition-opacity">
      <div className="w-8 flex justify-center">
        <div className="p-1.5 rounded-full bg-content2">
          {getIcon(event.action)}
        </div>
      </div>
      <div className="flex-1 text-sm">
        <span className="font-semibold text-foreground-500">{event.action}</span>
        {event.details && (
           <span className="text-foreground-400 mx-2">• {JSON.stringify(event.details)}</span>
        )}
      </div>
      <div className="text-xs text-foreground-400 whitespace-nowrap">
        {new Date(event.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

export function ActivityTimeline({ 
  comments = [], 
  history = [], 
  currentUserEmail,
  onEditComment, 
  onDeleteComment 
}: ActivityTimelineProps) {
  
  // Merge and sort
  const items: TimelineItem[] = [
    ...comments.map(c => ({ id: c.id, type: 'comment' as const, date: new Date(c.createdAt), data: c })),
    ...history.map(h => ({ id: h.id, type: 'history' as const, date: new Date(h.createdAt), data: h }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (items.length === 0) {
    return <div className="text-center py-8 text-foreground-400">No activity yet.</div>;
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Vertical Line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-content3 -z-10" />

      {items.map((item) => (
        <div key={`${item.type}-${item.id}`} className="relative">
           {item.type === 'comment' ? (
             <div className="pl-0">
               <CommentCard
                 comment={item.data}
                 currentUserEmail={currentUserEmail}
                 onEdit={onEditComment}
                 onDelete={onDeleteComment}
               />
             </div>
           ) : (
             <SystemEvent event={item.data} />
           )}
        </div>
      ))}
    </div>
  );
}
