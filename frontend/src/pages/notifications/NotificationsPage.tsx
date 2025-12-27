import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Tabs, Tab, Spinner } from '@heroui/react';
import { api } from '@/shared/api';
import { Icon } from '@/shared/ui';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // API supports ?isRead=false filtering
      const query = filter === 'unread' ? '?isRead=false' : '';
      const res = await api.get(`/notifications${query}`);
      // Handle different API response structures just in case
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      // Optimistic update
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
      if (filter === 'unread') {
          // Remove from list if filtering by unread
          setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
       console.error('Failed to mark all as read:', error);
       toast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }

    if (notification.metadata?.caseId) {
      navigate(`/cases/${notification.metadata.caseId}`);
    } else if (notification.metadata?.playbookId) {
        navigate(`/playbooks/${notification.metadata.playbookId}`);
    }
    // Add more navigation logic based on type/metadata here
  };

  const getIcon = (type: string) => {
      if (type.includes('approval')) return <Icon.FileText className="w-5 h-5 text-warning" />;
      if (type.includes('assigned')) return <Icon.User className="w-5 h-5 text-primary" />;
      if (type.includes('success')) return <Icon.CheckCircle className="w-5 h-5 text-success" />;
      if (type.includes('error') || type.includes('fail')) return <Icon.Alert className="w-5 h-5 text-danger" />;
      return <Icon.Bell className="w-5 h-5 text-foreground/60" />;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Notifications</h1>
          <p className="text-foreground/60 mt-1">Manage your alerts and activity history</p>
        </div>
        <Button 
            variant="flat" 
            color="primary" 
            startContent={<Icon.CheckCircle className="w-4 h-4" />}
            onPress={handleMarkAllAsRead}
        >
            Mark all as read
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <Tabs 
            selectedKey={filter} 
            onSelectionChange={(k) => setFilter(k as 'all' | 'unread')}
            variant="underlined"
            classNames={{
                cursor: "w-full bg-primary",
                tabContent: "group-data-[selected=true]:text-primary"
            }}
        >
            <Tab key="all" title={<div className="flex items-center gap-2"><Icon.Menu className="w-4 h-4"/>All</div>} />
            <Tab key="unread" title={<div className="flex items-center gap-2"><Icon.Bell className="w-4 h-4"/>Unread Only</div>} />
        </Tabs>

        {isLoading ? (
            <div className="flex justify-center py-20">
                <Spinner size="lg" />
            </div>
        ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-foreground/50">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Icon.Bell className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-lg font-medium">No notifications found</p>
                <p className="text-sm">You're all caught up!</p>
            </div>
        ) : (
            <div className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {notifications.map((notification) => (
                        <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                        >
                            <Card 
                                isPressable 
                                onPress={() => handleNotificationClick(notification)}
                                className={`w-full border transition-colors ${notification.isRead ? 'bg-transparent border-white/5 opacity-70 hover:opacity-100' : 'bg-white/5 border-primary/20'}`}
                            >
                                <CardBody className="flex flex-row items-center gap-4 p-4">
                                    <div className={`p-3 rounded-xl ${notification.isRead ? 'bg-white/5' : 'bg-primary/10'}`}>
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex justify-between items-start">
                                            <p className={`font-medium ${notification.isRead ? 'text-foreground/70' : 'text-foreground'}`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-xs text-foreground/50 whitespace-nowrap ml-4">
                                                {new Date(notification.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/60 mt-1 line-clamp-1">
                                            {notification.message}
                                        </p>
                                    </div>
                                    {!notification.isRead && (
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                    )}
                                </CardBody>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        )}
      </div>
    </div>
  );
}
