import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem, Divider } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { Icon } from '../../shared/ui';
import { Plus, Check, Zap } from 'lucide-react';

// Slack/Teams Logos
const SLACK_LOGO = "https://cdn.iconscout.com/icon/free/png-256/free-slack-1425877-1205068.png";
const TEAMS_LOGO = "https://cdn.iconscout.com/icon/free/png-256/free-microsoft-teams-3392312-2826315.png";

interface NotificationChannel {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'webhook';
  webhookUrl: string;
  enabled: boolean;
  minSeverity?: string;
  eventTypes?: string[];
  createdAt: string;
}

export default function NotificationChannelsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const { setPageContext } = usePageContext();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Form State
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  
  const [name, setName] = useState('');
  const [type, setType] = useState<'slack' | 'teams'>('slack');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState<string>('medium');
  const [eventTypes, setEventTypes] = useState<string[]>(['alert', 'case_assigned']);
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notification-channels');
      setChannels(data.data);
      
      setPageContext({
        pageName: 'Notification Channels',
        pageDescription: 'Manage external notification webhooks (Slack, Teams)',
        data: {
          totalChannels: data.data.length,
          activeChannels: data.data.filter((c: any) => c.enabled).length
        }
      });
    } catch (e) {
      console.error('Failed to fetch channels', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleOpenAdd = () => {
    setMode('add');
    setSelectedChannel(null);
    resetForm();
    onOpen();
  };

  const handleOpenEdit = (channel: NotificationChannel) => {
    setMode('edit');
    setSelectedChannel(channel);
    setName(channel.name);
    setType(channel.type as 'slack' | 'teams');
    setWebhookUrl(channel.webhookUrl); // Note: Backend returns masked URL usually, but for editing we might need to handle empty to keep existing
    setMinSeverity(channel.minSeverity || 'medium');
    setEventTypes(channel.eventTypes || []);
    setTestResult(null);
    onOpen();
  };

  const resetForm = () => {
    setName('');
    setType('slack');
    setWebhookUrl('');
    setMinSeverity('medium');
    // Default events
    setEventTypes(['alert', 'case_assigned']);
    setTestResult(null);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/notification-channels/test', {
        webhookUrl,
        type
      });
      setTestResult({ success: data.success, message: data.message });
    } catch (e: any) {
      setTestResult({ success: false, message: e.response?.data?.message || 'Webhook unreachable' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (onClose: () => void) => {
    try {
      const payload = {
        name,
        type,
        webhookUrl,
        minSeverity,
        eventTypes,
        enabled: true
      };

      if (mode === 'add') {
        await api.post('/notification-channels', payload);
      } else if (selectedChannel) {
        // Prepare update payload - if webhookUrl is masked or empty, don't send it to keep existing
        const updatePayload: any = { ...payload };
        if (!webhookUrl || webhookUrl.includes('***')) {
            delete updatePayload.webhookUrl;
        }
        await api.put(`/notification-channels/${selectedChannel.id}`, updatePayload);
      }

      fetchChannels();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save channel');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this channel?')) return;
    await api.delete(`/notification-channels/${id}`);
    fetchChannels();
  };

  const getLogo = (t: string) => {
    if (t === 'slack') return SLACK_LOGO;
    if (t === 'teams') return TEAMS_LOGO;
    return '';
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-default-500 bg-clip-text text-transparent">
            Notification Channels
          </h1>
          <p className="text-default-500 mt-1">Configure real-time alerts for Slack and Microsoft Teams</p>
        </div>
        <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={handleOpenAdd}>
            Add Channel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channels.map(channel => (
          <Card key={channel.id} className="border border-white/5 bg-content1/50 hover:bg-content1 transition-all">
            <CardBody className="p-5">
              <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 p-2 flex items-center justify-center">
                        <img src={getLogo(channel.type)} alt={channel.type} className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h3 className="font-semibold">{channel.name}</h3>
                        <p className="text-xs text-default-400 capitalize">{channel.type} Webhook</p>
                    </div>
                 </div>
                 <Chip size="sm" color={channel.enabled ? "success" : "default"} variant="flat">
                    {channel.enabled ? "Active" : "Disabled"}
                 </Chip>
              </div>
              
              <div className="space-y-2 text-sm text-default-500 mb-4">
                 <div className="flex justify-between">
                    <span>Min Severity:</span>
                    <Chip size="sm" color={channel.minSeverity === 'critical' ? 'danger' : 'warning'} variant="dot" className="capitalize">
                        {channel.minSeverity || 'Info'}
                    </Chip>
                 </div>
                 <div className="flex justify-between">
                    <span>Events:</span>
                    <span>{channel.eventTypes?.length || 0} types</span>
                 </div>
              </div>

              <div className="flex gap-2 mt-auto">
                 <Button size="sm" variant="flat" className="flex-1" onPress={() => handleOpenEdit(channel)}>
                    <Icon.Settings className="w-4 h-4 mr-2" /> Configure
                 </Button>
                 <Button size="sm" color="danger" variant="light" isIconOnly onPress={() => handleDelete(channel.id)}>
                    <Icon.Delete className="w-4 h-4" />
                 </Button>
              </div>
            </CardBody>
          </Card>
        ))}

        {channels.length === 0 && !loading && (
            <div className="col-span-full py-10 text-center text-default-500 border border-dashed border-white/10 rounded-2xl">
                <Icon.Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No notification channels configured yet.</p>
                <Button variant="light" color="primary" className="mt-2" onPress={handleOpenAdd}>
                    Add your first channel
                </Button>
            </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex gap-2 items-center">
                <Icon.Bell className="w-5 h-5" />
                {mode === 'add' ? 'Add Notification Channel' : 'Edit Channel'}
              </ModalHeader>
              <ModalBody className="gap-6">
                <Input
                    label="Channel Name"
                    placeholder="e.g. SOC Team Alerts"
                    value={name}
                    onValueChange={setName}
                    variant="bordered"
                />

                <div className="grid grid-cols-2 gap-4">
                     <div 
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${type === 'slack' ? 'border-primary bg-primary/10' : 'border-default-200 hover:border-default-400'}`}
                        onClick={() => setType('slack')}
                     >
                        <img src={SLACK_LOGO} className="w-8 h-8" />
                        <span className="font-semibold">Slack</span>
                     </div>
                     <div 
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${type === 'teams' ? 'border-primary bg-primary/10' : 'border-default-200 hover:border-default-400'}`}
                        onClick={() => setType('teams')}
                     >
                        <img src={TEAMS_LOGO} className="w-8 h-8" />
                        <span className="font-semibold">Teams</span>
                     </div>
                </div>

                <div className="gap-2">
                    <Input
                        label="Webhook URL"
                        placeholder="https://hooks.slack.com/services/..."
                        value={webhookUrl}
                        onValueChange={setWebhookUrl}
                        variant="bordered"
                        type="password"
                        description="Paste the Incoming Webhook URL from your provider"
                    />
                    <div className="flex justify-end mt-2">
                        <Button 
                            size="sm" 
                            variant="flat" 
                            color={testResult?.success ? "success" : "default"}
                            startContent={testResult?.success ? <Check className="w-4 h-4"/> : <Zap className="w-4 h-4"/>}
                            isLoading={testing}
                            onPress={handleTestWebhook}
                            isDisabled={!webhookUrl}
                        >
                            {testResult ? (testResult.success ? "Test Passed" : "Test Failed") : "Test Connection"}
                        </Button>
                    </div>
                    {testResult && !testResult.success && (
                        <p className="text-xs text-danger mt-1">{testResult.message}</p>
                    )}
                </div>

                <Divider />
                
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Notification Rules</h4>
                    <Select 
                        label="Minimum Severity" 
                        selectedKeys={[minSeverity]} 
                        onChange={(e) => setMinSeverity(e.target.value)}
                    >
                        <SelectItem key="info">Info (All)</SelectItem>
                        <SelectItem key="low">Low+</SelectItem>
                        <SelectItem key="medium">Medium+</SelectItem>
                        <SelectItem key="high">High+</SelectItem>
                        <SelectItem key="critical">Critical Only</SelectItem>
                    </Select>
                </div>

              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={() => handleSubmit(onClose)} isDisabled={!name || (!webhookUrl && mode === 'add')}>
                  Save Channel
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
