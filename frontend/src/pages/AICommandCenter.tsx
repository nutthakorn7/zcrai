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
  return (
    <div className="p-6 h-full flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Command Center</h1>
          <p className="text-sm mt-1 text-foreground/60">Autonomous SOC Analyst • Powered by Gemini Pro</p>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">System Active</span>
            </div>
            <Chip size="sm" variant="flat" color="primary">v2.0</Chip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-content1/50 border border-white/5 shadow-sm">
            <CardBody className="p-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg bg-${stat.color}/20 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}`} />
                </div>
                <div>
                  <div className={`text-xl font-bold text-${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-foreground/60">{stat.label}</div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
          {/* Main Chat Area - Left 2/3 */}
          <Card className="lg:col-span-2 bg-content1/50 border border-white/5 flex flex-col h-[600px] lg:h-auto">
            <CardBody className="p-0 flex flex-col h-full relative">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <Icon.Cpu className="w-12 h-12 mb-4" />
                            <h3 className="text-lg font-semibold">How can I help you?</h3>
                            <p className="text-sm text-foreground/60 max-w-xs">I can analyze threats, investigate incidents, and generate reports.</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && (
                                    <Avatar size="sm" icon={<Icon.Cpu className="w-4 h-4" />} className="flex-shrink-0" />
                                )}
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                                    msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-content2 text-foreground rounded-bl-none'
                                }`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <p className="text-[10px] opacity-50 mt-1 text-right">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                     {loading && (
                        <div className="flex gap-2 items-center text-xs text-foreground/50 ml-10">
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-100" />
                            <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce delay-200" />
                            Thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/5 bg-content2/20">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Ask me anything..." 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleQuery()}
                            isDisabled={loading}
                            className="flex-1"
                        />
                        <Button isIconOnly color="primary" onPress={() => handleQuery()} isLoading={loading} isDisabled={!query.trim()}>
                            <Icon.ArrowUpRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardBody>
          </Card>

          {/* Right Sidebar: Quick Commands & Nav */}
          <div className="flex flex-col gap-4">
              <Card className="bg-content1/50 border border-white/5">
                  <CardBody className="p-4">
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase mb-3">Quick Actions</h3>
                      <div className="flex flex-col gap-2">
                          {quickCommands.map((cmd, i) => (
                              <button 
                                key={i}
                                onClick={() => handleQuery(cmd.text)}
                                disabled={loading}
                                className="text-left p-3 rounded-lg hover:bg-content2 text-sm text-foreground/80 hover:text-primary transition-colors border border-transparent hover:border-primary/20 flex items-start gap-3"
                              >
                                  <span>{cmd.icon}</span>
                                  <span>{cmd.text}</span>
                              </button>
                          ))}
                      </div>
                  </CardBody>
              </Card>

              <Card className="bg-content1/50 border border-white/5">
                <CardBody className="p-4">
                     <h3 className="text-xs font-semibold text-foreground/50 uppercase mb-3">Jump To</h3>
                     <div className="grid grid-cols-2 gap-2">
                        {[
                            { icon: Icon.Alert, label: 'Alerts', path: '/alerts', color: 'text-warning' },
                            { icon: Icon.FileText, label: 'Cases', path: '/cases', color: 'text-primary' },
                            { icon: Icon.Cpu, label: 'Autopilot', path: '/autopilot', color: 'text-success' },
                            { icon: Icon.Dashboard, label: 'Dashboard', path: '/dashboard', color: 'text-secondary' },
                        ].map((item, i) => (
                            <Button 
                                key={i} 
                                variant="flat" 
                                className="justify-start h-auto py-2" 
                                onPress={() => navigate(item.path)}
                                startContent={<item.icon className={`w-4 h-4 ${item.color}`} />}
                            >
                                <span className="text-xs">{item.label}</span>
                            </Button>
                        ))}
                     </div>
                </CardBody>
              </Card>
          </div>
      </div>
    </div>
  );
}
