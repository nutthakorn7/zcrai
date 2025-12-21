import { useState, useEffect } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button, Badge } from '@heroui/react';
import { Icon } from '../shared/ui';
import { api } from '../shared/api/api';
import { ApprovalsAPI, ApprovalRequest } from '../shared/api/approvals';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      // Fetch pending approvals
      try {
           const pendingApprovals = await ApprovalsAPI.listPending();
           setApprovals(pendingApprovals);
      } catch (err) {
          console.error('Failed to fetch approvals', err);
      }

      // API returns { success, data: [] }, not just []
      const notificationsData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setNotifications(notificationsData.slice(0, 5)); // Show latest 5
      
      const countRes = await api.get('/notifications/unread-count');
      const count = countRes.data.count !== undefined ? countRes.data.count : 0;
      setUnreadCount(count + approvals.length); // Combine Unread + Pending Approvals
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark as read:', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      fetchNotifications();
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Navigate to case if metadata has caseId
    if (notification.metadata?.caseId) {
      navigate(`/cases/${notification.metadata.caseId}`);
    }
  };

  const handleApprovalAction = async (id: string, decision: 'approved' | 'rejected') => {
      try {
          setIsProcessing(true);
          await ApprovalsAPI.decide(id, decision, `Quick ${decision} via Notification Center`);
          
          // Remove from local state
          setApprovals(prev => prev.filter(a => a.id !== id));
          setUnreadCount(prev => Math.max(0, prev - 1));
          
          // Refresh to be safe
          fetchNotifications();
      } catch (error) {
          console.error('Approval failed', error);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button 
          isIconOnly 
          variant="light" 
          className="relative"
        >
          {unreadCount > 0 && (
            <Badge 
              content={unreadCount} 
              color="danger" 
              size="sm"
              className="absolute -top-1 -right-1"
            >
              <Icon.Bell className="w-5 h-5" />
            </Badge>
          )}
          {unreadCount === 0 && <Icon.Bell className="w-5 h-5" />}
        </Button>
      </DropdownTrigger>
      <DropdownMenu 
        aria-label="Notifications"
        className="w-80"
      >
        {notifications.length === 0 && approvals.length === 0 ? (
          <DropdownItem key="empty" isReadOnly>
            <p className="text-center text-gray-500">No notifications</p>
          </DropdownItem>
        ) : (
          <>
            <DropdownItem
              key="header"
              className="h-10 gap-2 border-b border-white/10"
              isReadOnly
            >
              <div className="flex justify-between items-center w-full">
                <p className="font-semibold text-sm">Notifications</p>
                {unreadCount > 0 && (
                  <Button 
                    size="sm" 
                    variant="light" 
                    onPress={handleMarkAllAsRead}
                    className="text-[10px] h-6 min-w-0 px-2"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </DropdownItem>

            {/* PENDING APPROVALS SECTION */}
            {approvals.map((approval) => (
                <DropdownItem
                    key={`approval-${approval.id}`}
                    className="h-auto py-3 bg-warning/5 border-l-2 border-warning mb-1"
                    isReadOnly
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Icon.ShieldAlert className="w-4 h-4 text-warning flex-shrink-0" />
                            <div>
                                <p className="font-medium text-sm text-foreground">Action Required</p>
                                <p className="text-xs text-foreground/60">
                                    {approval.playbook?.title}: {approval.step?.name}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-1 justify-end">
                            <Button 
                                size="sm" 
                                color="danger" 
                                variant="light" 
                                className="h-7 text-xs"
                                isDisabled={isProcessing}
                                onPress={() => handleApprovalAction(approval.id, 'rejected')}
                            >
                                Reject
                            </Button>
                            <Button 
                                size="sm" 
                                color="primary" 
                                variant="solid" 
                                className="h-7 text-xs"
                                isDisabled={isProcessing}
                                onPress={() => handleApprovalAction(approval.id, 'approved')}
                            >
                                Approve
                            </Button>
                        </div>
                    </div>
                </DropdownItem>
            ))}

            {/* NOTIFICATIONS SECTION */}

            {notifications.map((notif) => (
              <DropdownItem
                key={notif.id}
                className={`h-auto py-3 ${notif.isRead ? 'opacity-60' : ''} border-b border-white/5`}
                onPress={() => handleNotificationClick(notif)}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{notif.title}</p>
                      <p className="text-xs text-gray-400 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </DropdownItem>
            ))}

            <DropdownItem
              key="view-all"
              className="text-center text-primary"
              onPress={() => navigate('/notifications')}
            >
              View All Notifications
            </DropdownItem>
          </>
        )}
      </DropdownMenu>
    </Dropdown>
  );
}
