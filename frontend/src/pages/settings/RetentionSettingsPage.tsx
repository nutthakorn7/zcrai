import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Divider } from "@heroui/react";
import { toast } from 'react-hot-toast';
import { api } from '../../shared/api/api';
import { Loader2, Trash2 } from 'lucide-react';

export default function RetentionSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  
  const [settings, setSettings] = useState({
    auditLogDays: 90,
    notificationDays: 30,
    sessionDays: 7
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings/retention');
      setSettings(res.data);
    } catch (error) {
      toast.error('Failed to load retention settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/settings/retention', {
        auditLogDays: parseInt(String(settings.auditLogDays)),
        notificationDays: parseInt(String(settings.notificationDays)),
        sessionDays: parseInt(String(settings.sessionDays))
      });
      toast.success('Retention policy updated');
    } catch (error) {
      toast.error('Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCleanup = async () => {
    if (!confirm('Are you sure you want to run cleanup now? This is irreversible.')) return;
    
    try {
      setTriggering(true);
      await api.post('/admin/settings/retention/trigger', {});
      toast.success('Cleanup job triggered in background');
    } catch (error) {
      toast.error('Failed to trigger cleanup');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Retention Policy</h1>
        <p className="text-default-500">Configure automated data cleanup schedules to meet compliance requirements.</p>
      </div>

      <Card>
        <CardBody className="gap-6 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Retention Periods (Days)</h3>
            <Button
              color="danger"
              variant="flat"
              startContent={triggering ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
              onPress={handleTriggerCleanup}
              disabled={triggering}
            >
              {triggering ? 'Running...' : 'Run Cleanup Now'}
            </Button>
          </div>
          
          <Divider />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Input
              label="Audit Logs Retention"
              type="number"
              placeholder="90"
              endContent={<div className="text-default-400 text-sm">Days</div>}
              value={String(settings.auditLogDays)}
              onValueChange={(v) => setSettings({...settings, auditLogDays: parseInt(v) || 0})}
              description="Historical actions and login logs"
            />
            
            <Input
              label="Notifications Retention"
              type="number"
              placeholder="30"
              endContent={<div className="text-default-400 text-sm">Days</div>}
              value={String(settings.notificationDays)}
              onValueChange={(v) => setSettings({...settings, notificationDays: parseInt(v) || 0})}
              description="User notifications and alerts"
            />
            
            <Input
              label="Expired Sessions Retention"
              type="number"
              placeholder="7"
              endContent={<div className="text-default-400 text-sm">Days</div>}
              value={String(settings.sessionDays)}
              onValueChange={(v) => setSettings({...settings, sessionDays: parseInt(v) || 0})}
              description="Buffer period for expired sessions"
            />
          </div>

          <div className="flex justify-end mt-4">
            <Button 
              color="primary" 
              onPress={handleSave}
              isLoading={saving}
            >
              Save Changes
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-warning-50/50">
        <CardBody className="p-4">
          <div className="flex gap-4">
            <div className="p-2 bg-warning/10 rounded-lg h-fit">
              <Trash2 className="text-warning" size={24} />
            </div>
            <div>
              <h4 className="font-semibold text-warning-700">Warning: Permanent Deletion</h4>
              <p className="text-sm text-default-600 mt-1">
                Data removed by the cleanup job cannot be recovered. 
                Ensure your retention periods comply with your organization&apos;s legal requirements (e.g., ISO 27001 requires audit logs &gt; 90 days).
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
