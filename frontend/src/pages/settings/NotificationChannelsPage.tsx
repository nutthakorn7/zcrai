import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Chip, Select, SelectItem, Divider } from "@heroui/react";
import { api } from "../../shared/api/api";
import { usePageContext } from "../../contexts/PageContext";
import { Icon } from '../../shared/ui';
import { Plus, Check, Zap } from 'lucide-react';

// SVG Logos replaced by inline components


interface NotificationChannel {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'line' | 'webhook';
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
  const [type, setType] = useState<'slack' | 'teams' | 'line'>('slack');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState<string>('medium');
  const [eventTypes, setEventTypes] = useState<string[]>(['alert', 'case_assigned']);
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notification-channels');
      setChannels(data.data);
      
      setPageContext({
        pageName: 'Notification Channels',
        pageDescription: 'Manage external notification webhooks (Slack, Teams)',
        data: {
          totalChannels: data.data.length,
          activeChannels: data.data.filter((c: NotificationChannel) => c.enabled).length
        }
      });
    } catch (e) {
      console.error('Failed to fetch channels', e);
    } finally {
      setLoading(false);
    }
  }, [setPageContext]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

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
    } catch (e) {
      setTestResult({ success: false, message: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Webhook unreachable' });
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
        const updatePayload: Partial<NotificationChannel> & { webhookUrl?: string } = { ...payload };
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
    if (t === 'slack') return (
       <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.52 2.52 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.523v-3.792zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52h-2.521zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.166 18.956a2.528 2.528 0 0 1 2.522 2.521A2.527 2.527 0 0 1 15.166 24a2.527 2.527 0 0 1-2.522-2.523v-2.52h2.522zM15.166 17.688a2.527 2.527 0 0 1-2.522-2.521 2.527 2.527 0 0 1 2.522-2.52H21.48a2.527 2.527 0 0 1 2.52 2.52 2.527 2.527 0 0 1-2.52 2.52h-6.314z" fill="#E01E5A"/>
         <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.52 2.52 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#36C5F0"/>
         <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#2EB67D"/>
         <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52h-2.521z" fill="#ECB22E"/>
       </svg>
    );
    if (t === 'teams') return (
       <svg viewBox="0 0 16 16" className="w-full h-full" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
         <path d="M9.186 4.797a2.42 2.42 0 1 0-2.86-2.448h1.178c.929 0 1.682.753 1.682 1.682zm-4.295 7.738h2.613c.929 0 1.682-.753 1.682-1.682V5.58h2.783a.7.7 0 0 1 .682.716v4.294a4.197 4.197 0 0 1-4.093 4.293c-1.618-.04-3-.99-3.667-2.35Zm10.737-9.372a1.674 1.674 0 1 1-3.349 0 1.674 1.674 0 0 1 3.349 0m-2.238 9.488-.12-.002a5.2 5.2 0 0 0 .381-2.07V6.306a1.7 1.7 0 0 0-.15-.725h1.792c.39 0 .707.317.707.707v3.765a2.6 2.6 0 0 1-2.598 2.598z" fill="#4ea2e8" />
         <path d="M.682 3.349h6.822c.377 0 .682.305.682.682v6.822a.68.68 0 0 1-.682.682H.682A.68.68 0 0 1 0 10.853V4.03c0-.377.305-.682.682-.682Zm5.206 2.596v-.72h-3.59v.72h1.357V9.66h.87V5.945z" fill="#5059c9"/>
       </svg>
    );
    if (t === 'line') return (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.572-3.843 2.572-5.992z" fill="#06C755"/>
        </svg>
    );
    return null;
  };

  return (
    <div className="space-y-8 w-full p-6">
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
                        {getLogo(channel.type)}
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

                <div className="grid grid-cols-3 gap-4">
                     <div 
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${type === 'slack' ? 'border-primary bg-primary/10' : 'border-default-200 hover:border-default-400'}`}
                        onClick={() => setType('slack')}
                     >
                        <div className="w-8 h-8 text-primary">
                            {getLogo('slack')}
                        </div>
                        <span className="font-semibold">Slack</span>
                     </div>
                     <div 
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${type === 'teams' ? 'border-primary bg-primary/10' : 'border-default-200 hover:border-default-400'}`}
                        onClick={() => setType('teams')}
                     >
                        <div className="w-8 h-8 text-primary">
                             {getLogo('teams')}
                        </div>
                        <span className="font-semibold">Teams</span>
                     </div>
                     <div 
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${type === 'line' ? 'border-primary bg-primary/10' : 'border-default-200 hover:border-default-400'}`}
                        onClick={() => setType('line')}
                     >
                        <div className="w-8 h-8 text-primary">
                             {getLogo('line')}
                        </div>
                        <span className="font-semibold">Line</span>
                     </div>
                </div>

                <div className="gap-2">
                    <Input
                        label={type === 'line' ? "Access Token" : "Webhook URL"}
                        placeholder={type === 'line' ? "Paste token from notify-bot.line.me" : "https://hooks.slack.com/services/..."}
                        value={webhookUrl}
                        onValueChange={setWebhookUrl}
                        variant="bordered"
                        type="password"
                        description={
                            type === 'line' 
                            ? <span>Get token from <a href="https://notify-bot.line.me/my/" target="_blank" rel="noreferrer" className="text-primary underline">notify-bot.line.me/my/</a></span>
                            : "Paste the Incoming Webhook URL from your provider"
                        }
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
