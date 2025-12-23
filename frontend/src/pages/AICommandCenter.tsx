import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Chip } from '@heroui/react';
import { Icon } from '../../shared/ui';
import { api } from '../../shared/api/api';

interface AIStatus {
  isActive: boolean;
  securityScore: number;
  threatsAutoRemediated: number;
  needsReview: number;
  activeInvestigations: number;
  aiHandledToday: number;
}

interface ApprovalItem {
  id: string;
  title: string;
  aiConfidence: number;
  recommendation: string;
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export default function AICommandCenter() {
  const [query, setQuery] = useState('');
  const [aiStatus, setAIStatus] = useState<AIStatus>({
    isActive: true,
    securityScore: 95,
    threatsAutoRemediated: 2,
    needsReview: 0,
    activeInvestigations: 3,
    aiHandledToday: 47,
  });
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [showAIHandled, setShowAIHandled] = useState(false);

  useEffect(() => {
    loadAIStatus();
    loadApprovalQueue();
  }, []);

  const loadAIStatus = async () => {
    try {
      const res = await api.get('/ai/status');
      if (res.data) setAIStatus(res.data);
    } catch (e) {
      console.error('Failed to load AI status:', e);
    }
  };

  const loadApprovalQueue = async () => {
    try {
      const res = await api.get('/ai/approval-queue');
      if (res.data) setApprovalQueue(res.data);
    } catch (e) {
      console.error('Failed to load approval queue:', e);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    
    try {
      const res = await api.post('/ai/query', { query });
      console.log('AI Response:', res.data);
      // Handle AI response (show in modal or inline)
    } catch (e) {
      console.error('AI query failed:', e);
    }
  };

  const handleApprove = async (itemId: string) => {
    try {
      await api.post('/ai/approve', { actionId: itemId, decision: 'approve' });
      setApprovalQueue(prev => prev.filter(item => item.id !== itemId));
      loadAIStatus(); // Refresh status
    } catch (e) {
      console.error('Approval failed:', e);
    }
  };

  const handleReject = async (itemId: string) => {
    try {
      await api.post('/ai/approve', { actionId: itemId, decision: 'reject' });
      setApprovalQueue(prev => prev.filter(item => item.id !== itemId));
    } catch (e) {
      console.error('Rejection failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon.Shield className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">AI Security Operations Center</h1>
        </div>
      </div>

      {/* AI Command Bar */}
      <Card className="bg-content1/50 border border-primary/20">
        <CardBody className="p-6">
          <div className="flex gap-3">
            <Input
              placeholder="What's happening in my environment?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              size="lg"
              startContent={<Icon.Search className="w-5 h-5 text-default-400" />}
              classNames={{
                input: "text-lg",
                inputWrapper: "bg-content2/50 border-white/10"
              }}
            />
            <Button 
              color="primary" 
              size="lg"
              onPress={handleQuery}
              isDisabled={!query.trim()}
            >
              Ask AI
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* AI Status Banner */}
      <Card className={`border-l-4 ${aiStatus.isActive ? 'border-l-success bg-success/5' : 'border-l-warning bg-warning/5'}`}>
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Icon.Cpu className={`w-10 h-10 ${aiStatus.isActive ? 'text-success' : 'text-warning'}`} />
                {aiStatus.isActive && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {aiStatus.isActive ? '🟢 AI Autopilot Active' : '🟡 AI Autopilot Paused'}
                </h2>
                <p className="text-foreground/60 text-sm mt-1">
                  Your environment is <span className="text-success font-mono">{aiStatus.securityScore}%</span> secure
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{aiStatus.threatsAutoRemediated}</div>
                <div className="text-foreground/60">Auto-remediated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">{aiStatus.needsReview}</div>
                <div className="text-foreground/60">Need review</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-content1/50 border border-white/5">
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Icon.Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-sm text-foreground/60">Active Now</div>
                <div className="text-2xl font-bold">{aiStatus.activeInvestigations} Investigations</div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-content1/50 border border-white/5">
          <CardBody className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center">
                <Icon.TrendingDown className="w-6 h-6 text-success" />
              </div>
              <div>
                <div className="text-sm text-foreground/60">AI Insights</div>
                <div className="text-2xl font-bold">Trend: ↓ 20%</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Approval Queue */}
      {approvalQueue.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            📋 Needs Your Attention ({approvalQueue.length})
          </h3>
          {approvalQueue.map((item) => (
            <Card key={item.id} className="bg-content1/50 border border-warning/30">
              <CardBody className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Chip size="sm" color="warning" variant="flat">
                        {item.severity.toUpperCase()}
                      </Chip>
                      <Chip size="sm" color="primary" variant="flat">
                        AI: {item.aiConfidence}% confident
                      </Chip>
                    </div>
                    <h4 className="text-lg font-semibold mb-1">{item.title}</h4>
                    <p className="text-sm text-foreground/60 mb-2">{item.details}</p>
                    <p className="text-sm text-primary">
                      <strong>Recommend:</strong> {item.recommendation}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      color="success" 
                      variant="flat"
                      onPress={() => handleApprove(item.id)}
                    >
                      Approve
                    </Button>
                    <Button 
                      color="default" 
                      variant="flat"
                      onPress={() => handleReject(item.id)}
                    >
                      Review Details
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* AI Handled Today */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            ✅ AI Handled Today ({aiStatus.aiHandledToday})
          </h3>
          <Button 
            size="sm" 
            variant="flat"
            onPress={() => setShowAIHandled(!showAIHandled)}
          >
            {showAIHandled ? 'Hide' : 'View All'}
          </Button>
        </div>
        {showAIHandled && (
          <Card className="bg-content1/50 border border-white/5">
            <CardBody className="p-6">
              <p className="text-foreground/60 text-center">
                AI automatically handled {aiStatus.aiHandledToday} security events today.
                <br />
                No human intervention required.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
