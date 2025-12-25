import { useState, useRef, useEffect } from 'react';
import { Card, CardBody, Button, Input, Chip, Avatar } from '@heroui/react';
import { Icon } from '../shared/ui';
import { useNavigate } from 'react-router-dom';
import { AIAPI } from '../shared/api/ai';

interface Message {
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

export default function AICommandCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [securityScore] = useState(95);
  const [activeThreats] = useState(0);
  const [aiReady] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuery = async (text?: string) => {
    const message = text || query;
    if (!message.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message, timestamp: new Date() }]);
    setLoading(true);
    setQuery('');
    
    try {
      const res = await AIAPI.chat([{ role: 'user', content: message }]);
      console.log('AI Response:', res.data);
      
      if (res.data?.success && res.data?.message) {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: res.data.message,
          timestamp: new Date()
        }]);
      } else if (res.data?.message) {
        // Backend returned error with message
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: `Error: ${res.data.message}`,
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: 'No response from AI.',
          timestamp: new Date()
        }]);
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `Error: ${err.response?.data?.message || err.message || 'Please try again later.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const quickCommands = [
    { icon: '🔍', text: "Summarize critical alerts from the last 24h" },
    { icon: '🕵️', text: "Are there any signs of lateral movement?" },
    { icon: '🌐', text: "Check for suspicious outbound traffic" },
    { icon: '📊', text: "Generate a weekly security health report" },
  ];

  const stats = [
    { label: 'Security Score', value: `${securityScore}%`, color: 'success', icon: Icon.Shield },
    { label: 'Active Threats', value: activeThreats, color: activeThreats > 0 ? 'danger' : 'success', icon: Icon.Alert },
    { label: 'AI Status', value: aiReady ? 'Online' : 'Offline', color: aiReady ? 'success' : 'danger', icon: Icon.Cpu },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      <div className="relative z-10 p-8 max-w-7xl mx-auto">
        {/* Header with Gradient */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-primary font-medium">AI System Active</span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
            AI Command Center
          </h1>
          <p className="text-foreground/60 text-lg">Your Autonomous SOC Analyst • Powered by Gemini Pro</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat, i) => (
            <Card key={i} className="bg-content1/50 backdrop-blur-xl border border-white/10 hover:border-primary/30 transition-all duration-300">
              <CardBody className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-${stat.color}/20 flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold text-${stat.color}`}>{stat.value}</div>
                    <div className="text-sm text-foreground/60">{stat.label}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Main Chat Area */}
        <Card className="mb-6 bg-content1/50 backdrop-blur-xl border border-white/10 overflow-hidden">
          <CardBody className="p-0">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Icon.Cpu className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold">zcrAI Analyst</div>
                    <div className="text-xs text-foreground/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Ready to assist
                    </div>
                  </div>
                </div>
                <Chip size="sm" color="success" variant="flat">v2.0</Chip>
              </div>
            </div>

            {/* Messages Area */}
            <div className="h-[400px] overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                    <Icon.Cpu className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">How can I help you today?</h3>
                  <p className="text-foreground/60 max-w-md">
                    I can analyze threats, investigate incidents, generate reports, and answer security questions.
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    {msg.role === 'ai' && (
                      <Avatar 
                        size="sm" 
                        className="bg-gradient-to-br from-primary to-secondary"
                        icon={<Icon.Cpu className="w-4 h-4 text-white" />}
                      />
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-white rounded-br-md' 
                        : 'bg-content2 text-foreground rounded-bl-md'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-foreground/40'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {msg.role === 'user' && (
                      <Avatar size="sm" className="bg-content3" icon={<Icon.User className="w-4 h-4" />} />
                    )}
                  </div>
                ))
              )}
              
              {/* Typing Indicator */}
              {loading && (
                <div className="flex gap-3 animate-in fade-in">
                  <Avatar 
                    size="sm" 
                    className="bg-gradient-to-br from-primary to-secondary"
                    icon={<Icon.Cpu className="w-4 h-4 text-white" />}
                  />
                  <div className="bg-content2 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-6 py-4 border-t border-white/10 bg-content2/30">
              <div className="flex gap-3">
                <Input
                  placeholder="Ask AI anything... (e.g., 'Summarize today's threats')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleQuery()}
                  size="lg"
                  startContent={<Icon.Search className="w-5 h-5 text-foreground/40" />}
                  classNames={{
                    inputWrapper: "bg-content1 border border-white/10 hover:border-primary/30 transition-colors"
                  }}
                  isDisabled={loading}
                />
                <Button 
                  color="primary" 
                  size="lg"
                  className="px-6 bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20"
                  onPress={() => handleQuery()}
                  isDisabled={!query.trim() || loading}
                  isLoading={loading}
                >
                  <Icon.ArrowUpRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Quick Commands */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground/60 mb-3 uppercase tracking-wider">Quick Commands</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => handleQuery(cmd.text)}
                disabled={loading}
                className="text-left px-4 py-3 rounded-xl bg-content1/50 backdrop-blur-sm border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cmd.icon}</span>
                  <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">{cmd.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Icon.Alert, label: 'Alerts', path: '/alerts', color: 'warning' },
            { icon: Icon.FileText, label: 'Cases', path: '/cases', color: 'primary' },
            { icon: Icon.Cpu, label: 'Autopilot', path: '/autopilot', color: 'success' },
            { icon: Icon.Dashboard, label: 'Dashboard', path: '/dashboard', color: 'secondary' },
          ].map((item, i) => (
            <Card 
              key={i}
              isPressable
              onPress={() => navigate(item.path)}
              className="bg-content1/50 backdrop-blur-sm border border-white/10 hover:border-primary/30 hover:scale-[1.02] transition-all duration-300"
            >
              <CardBody className="p-5 text-center">
                <div className={`w-12 h-12 rounded-xl bg-${item.color}/20 flex items-center justify-center mx-auto mb-3`}>
                  <item.icon className={`w-6 h-6 text-${item.color}`} />
                </div>
                <div className="font-semibold">{item.label}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Footer Status */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-content1/50 backdrop-blur-sm border border-white/10">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-foreground/60">AI is monitoring your environment 24/7</span>
            <span className="text-xs text-foreground/40">•</span>
            <span className="text-xs text-foreground/40">Last scan: just now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
