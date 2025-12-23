import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Input, Chip } from '@heroui/react';
import { Icon } from '../../shared/ui';
import { api } from '../../shared/api/api';
import { useNavigate } from 'react-router-dom';

export default function AICommandCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [securityScore] = useState(95);
  const [needsReview] = useState(0);

  const handleQuery = () => {
    if (!query.trim()) return;
    // TODO: Implement AI query
    console.log('AI Query:', query);
  };

  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto">
      
      {/* Simple Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Security Operations</h1>
        <p className="text-foreground/60">Zero-Touch AI SOC</p>
      </div>

      {/* AI Status - Simple */}
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

      {/* AI Command Bar - Simple */}
      <Card className="mb-6">
        <CardBody className="p-6">
          <div className="flex gap-3">
            <Input
              placeholder="Ask AI anything... (e.g., 'Show me threats')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              size="lg"
              startContent={<Icon.Search className="w-5 h-5" />}
              classNames={{
                inputWrapper: "bg-content2/50"
              }}
            />
            <Button 
              color="primary" 
              size="lg"
              onPress={handleQuery}
              isDisabled={!query.trim()}
            >
              Ask
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Quick Actions - Simple */}
      <div className="grid grid-cols-3 gap-4">
        <Card 
          isPressable
          onPress={() => navigate('/alerts')}
          className="hover:border-primary/30 transition-all"
        >
          <CardBody className="p-6 text-center">
            <Icon.AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
            <div className="font-semibold">Alerts</div>
            <div className="text-sm text-foreground/60">View all</div>
          </CardBody>
        </Card>

        <Card 
          isPressable
          onPress={() => navigate('/cases')}
          className="hover:border-primary/30 transition-all"
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
          className="hover:border-primary/30 transition-all"
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
