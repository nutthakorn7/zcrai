import { useState } from 'react';
import { Card, CardBody, Button, Input } from '@heroui/react';
import { Icon } from '../shared/ui';
import { useNavigate } from 'react-router-dom';
import { AIAPI } from '../shared/api/ai';

export default function AICommandCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ role: 'ai' | 'user', content: string } | null>(null);
  const [securityScore] = useState(95);
  const [needsReview] = useState(0);

  const handleQuery = async (text?: string) => {
    const message = text || query;
    if (!message.trim()) return;
    
    setLoading(true);
    setResponse(null);
    try {
      const res = await AIAPI.chat([{ role: 'user', content: message }]);
      if (res.data) {
        setResponse({ role: 'ai', content: res.data.message || res.data });
      }
    } catch (err) {
      console.error('AI Error:', err);
      setResponse({ role: 'ai', content: 'Sorry, I encountered an error. Please try again later.' });
    } finally {
      setLoading(false);
      setQuery('');
    }
  };

  const quickCommands = [
    "Summarize critical alerts from the last 24h",
    "Are there any signs of lateral movement?",
    "Check for suspicious outbound traffic",
    "Generate a weekly security health report"
  ];

  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto">
      
      {/* Simple Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Command Center</h1>
        <p className="text-foreground/60">Your Autonomous SOC Analyst</p>
      </div>

      {/* AI Status */}
      <Card className="mb-6 border-l-4 border-l-success bg-success/5">
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <Icon.CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold">🟢 All Clear</h2>
                <p className="text-sm text-foreground/60">
                  Your environment is <span className="text-success font-mono">{securityScore}%</span> secure
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-success">{needsReview}</div>
              <div className="text-sm text-foreground/60">Need Review</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Command Bar */}
      <Card className="mb-6">
        <CardBody className="p-6">
          <div className="flex gap-3">
            <Input
              placeholder="Ask AI anything... (e.g., 'Summarize incidents')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              size="lg"
              startContent={<Icon.Search className="w-5 h-5" />}
              classNames={{
                inputWrapper: "bg-content2/50"
              }}
              isDisabled={loading}
            />
            <Button 
              color="primary" 
              size="lg"
              onPress={() => handleQuery()}
              isDisabled={!query.trim() || loading}
              isLoading={loading}
            >
              Ask
            </Button>
          </div>

          {/* Quick Command Chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {quickCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => handleQuery(cmd)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full bg-content2 hover:bg-content3 text-foreground/60 transition-colors border border-white/5"
              >
                {cmd}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* AI Response Display */}
      {response && (
        <Card className="mb-6 bg-content1 border border-primary/20 animate-in fade-in slide-in-from-top-4">
          <CardBody className="p-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon.Cpu className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-3">
                <div className="font-bold text-primary text-sm uppercase tracking-wider">zcrAI Analyst</div>
                <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {response.content}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card 
          isPressable
          onPress={() => navigate('/alerts')}
          className="hover:border-primary/30 transition-all bg-content1"
        >
          <CardBody className="p-6 text-center">
            <Icon.Alert className="w-8 h-8 mx-auto mb-2 text-warning" />
            <div className="font-semibold">Alerts</div>
            <div className="text-sm text-foreground/60">View all</div>
          </CardBody>
        </Card>

        <Card 
          isPressable
          onPress={() => navigate('/cases')}
          className="hover:border-primary/30 transition-all bg-content1"
        >
          <CardBody className="p-6 text-center">
            <Icon.FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="font-semibold">Cases</div>
            <div className="text-sm text-foreground/60">Investigations</div>
          </CardBody>
        </Card>

        <Card 
          isPressable
          onPress={() => navigate('/autopilot')}
          className="hover:border-primary/30 transition-all bg-content1"
        >
          <CardBody className="p-6 text-center">
            <Icon.Cpu className="w-8 h-8 mx-auto mb-2 text-success" />
            <div className="font-semibold">AI Autopilot</div>
            <div className="text-sm text-foreground/60">Auto actions</div>
          </CardBody>
        </Card>
      </div>

      {/* Empty State - Simple */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-content2/50">
          <Icon.CheckCircle className="w-4 h-4 text-success" />
          <span className="text-sm text-foreground/60">
            AI is monitoring your environment 24/7
          </span>
        </div>
      </div>

    </div>
  );
}
