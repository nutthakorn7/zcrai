import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Button, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tabs, Tab, Chip, Spinner, Select, SelectItem, ButtonGroup, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, useDisclosure } from "@heroui/react";
import { Icon } from '../shared/ui';
import { api } from '../shared/api/api';
import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// Time range options
const TIME_RANGES = [
    { key: '1h', label: 'Last 1 Hour', interval: '1 HOUR' },
    { key: '24h', label: 'Last 24 Hours', interval: '1 DAY' },
    { key: '7d', label: 'Last 7 Days', interval: '7 DAY' },
    { key: '30d', label: 'Last 30 Days', interval: '30 DAY' },
    { key: 'all', label: 'All Time', interval: null },
];

// Saved queries type
interface SavedQuery {
    id: string;
    name: string;
    query: string;
    type: 'sql' | 'natural';
    createdAt: string;
}

// Query History interface
interface QueryHistoryItem {
    id: string;
    query: string;
    type: 'sql' | 'natural' | 'sigma';
    resultCount: number;
    executedAt: string;
    generatedSql?: string;
}

export default function HuntingPage() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("ai");
    const [query, setQuery] = useState("SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 50");
    const [naturalQuery, setNaturalQuery] = useState("");
    const [sigmaYaml, setSigmaYaml] = useState(`title: Suspicious Process Creation
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        Image: 'cmd.exe'
    condition: selection`);
    const [results, setResults] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [generatedSql, setGeneratedSql] = useState("");
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'timeline'>('bar');
    const [chartField, setChartField] = useState('severity');
    const [timeRange, setTimeRange] = useState('24h');
    
    // Save Query Modal
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [queryName, setQueryName] = useState("");
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [showSavedQueries, setShowSavedQueries] = useState(false);
    
    // Query History
    const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    
    // AI Follow-up Suggestions
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Load saved queries and history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('hunting_saved_queries');
        if (saved) {
            setSavedQueries(JSON.parse(saved));
        }
        const history = localStorage.getItem('hunting_query_history');
        if (history) {
            setQueryHistory(JSON.parse(history));
        }
    }, []);
    
    // Add to query history
    const addToHistory = (queryText: string, type: 'sql' | 'natural' | 'sigma', resultCount: number, genSql?: string) => {
        const newItem: QueryHistoryItem = {
            id: Date.now().toString(),
            query: queryText,
            type,
            resultCount,
            executedAt: new Date().toISOString(),
            generatedSql: genSql
        };
        const updated = [newItem, ...queryHistory].slice(0, 50); // Keep last 50
        setQueryHistory(updated);
        localStorage.setItem('hunting_query_history', JSON.stringify(updated));
    };
    
    // Load from history
    const handleLoadFromHistory = (item: QueryHistoryItem) => {
        if (item.type === 'natural') {
            setNaturalQuery(item.query);
            setActiveTab('ai');
            if (item.generatedSql) setGeneratedSql(item.generatedSql);
        } else if (item.type === 'sql') {
            setQuery(item.query);
            setActiveTab('sql');
        } else {
            setSigmaYaml(item.query);
            setActiveTab('sigma');
            if (item.generatedSql) setGeneratedSql(item.generatedSql);
        }
        setShowHistory(false);
    };
    
    // Clear history
    const handleClearHistory = () => {
        setQueryHistory([]);
        localStorage.removeItem('hunting_query_history');
    };

    // Aggregatable fields for charts
    const aggregatableFields = useMemo(() => {
        return columns.filter(col => 
            ['severity', 'event_type', 'source', 'host_name', 'user_name', 'mitre_tactic', 'mitre_technique', 'network_protocol'].includes(col)
        );
    }, [columns]);

    // Calculate chart data based on selected field
    const chartData = useMemo(() => {
        if (!results.length || !chartField) return [];
        
        const counts: Record<string, number> = {};
        results.forEach(row => {
            const value = row[chartField] || 'Unknown';
            counts[value] = (counts[value] || 0) + 1;
        });
        
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [results, chartField]);

    // Timeline data (events over time)
    const timelineData = useMemo(() => {
        if (!results.length) return [];
        
        const hourCounts: Record<string, number> = {};
        results.forEach(row => {
            if (row.timestamp) {
                const date = new Date(row.timestamp);
                const hour = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:00`;
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });
        
        return Object.entries(hourCounts)
            .map(([time, count]) => ({ time, count }))
            .slice(-24);
    }, [results]);

    useEffect(() => {
        const q = searchParams.get('query');
        const host = searchParams.get('host');
        const user = searchParams.get('user');

        if (q) {
            setQuery(q);
            setActiveTab("sql");
            handleRunQuery(q);
        } else if (host) {
            const sql = `SELECT * FROM security_events WHERE host_name = '${host}' ORDER BY timestamp DESC LIMIT 50`;
            setQuery(sql);
            setActiveTab("sql");
            handleRunQuery(sql);
        } else if (user) {
            const sql = `SELECT * FROM security_events WHERE user_name = '${user}' ORDER BY timestamp DESC LIMIT 50`;
            setQuery(sql);
            setActiveTab("sql");
            handleRunQuery(sql);
        }
    }, [searchParams]);

    // Set default chart field when columns change
    useEffect(() => {
        if (aggregatableFields.length > 0 && !aggregatableFields.includes(chartField)) {
            setChartField(aggregatableFields[0]);
        }
    }, [aggregatableFields]);

    const handleRunQuery = async (overrideQuery?: string) => {
        const targetQuery = overrideQuery || query;
        if (!targetQuery) return;

        setLoading(true);
        setError("");
        setResults([]);
        try {
            const res = await api.post('/hunting/query', { query: targetQuery });
            if (res.data.success) {
                const data = res.data.data;
                setResults(data);
                if (data.length > 0) {
                    setColumns(Object.keys(data[0]));
                }
                // Add to history
                addToHistory(targetQuery, 'sql', data.length);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRunSigma = async () => {
        setLoading(true);
        setError("");
        setResults([]);
        setGeneratedSql("");
        try {
            const res = await api.post('/hunting/sigma', { yaml: sigmaYaml, execute: true });
            if (res.data.success) {
                setGeneratedSql(res.data.data.generatedSql);
                const data = res.data.data.results;
                setResults(data);
                if (data.length > 0) {
                    setColumns(Object.keys(data[0]));
                }
                // Add to history
                addToHistory(sigmaYaml, 'sigma', data.length, res.data.data.generatedSql);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAskAI = async () => {
        if (!naturalQuery.trim()) return;

        setLoading(true);
        setError("");
        setResults([]);
        setGeneratedSql("");
        
        // Add time context to the question
        const timeContext = timeRange !== 'all' 
            ? ` (ในช่วง ${TIME_RANGES.find(r => r.key === timeRange)?.label})` 
            : '';
        const questionWithTime = naturalQuery + timeContext;
        
        try {
            const res = await api.post('/hunting/natural', { question: questionWithTime, execute: true });
            if (res.data.success) {
                setGeneratedSql(res.data.data.generatedSql);
                const data = res.data.data.results;
                setResults(data);
                if (data.length > 0) {
                    setColumns(Object.keys(data[0]));
                }
                // Add to history
                addToHistory(naturalQuery, 'natural', data.length, res.data.data.generatedSql);
                // Fetch AI follow-up suggestions
                if (data.length > 0) {
                    fetchAiSuggestions(naturalQuery, data);
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    // Export to CSV
    const handleExportCSV = () => {
        if (!results.length) return;
        
        const headers = columns.join(',');
        const rows = results.map(row => 
            columns.map(col => {
                const val = row[col];
                if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',')
        );
        
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hunting_results_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Fetch AI Follow-up Suggestions
    const fetchAiSuggestions = async (originalQ: string, resultData: any[]) => {
        if (!resultData.length) return;
        
        setLoadingSuggestions(true);
        setAiSuggestions([]);
        
        try {
            // Extract top values from results for context
            const topValues: Record<string, string[]> = {};
            ['severity', 'host_name', 'user_name', 'network_src_ip', 'network_dst_ip', 'event_type'].forEach(field => {
                const vals = resultData
                    .map(r => r[field])
                    .filter(v => v && v !== '')
                    .slice(0, 3);
                if (vals.length) topValues[field] = [...new Set(vals)];
            });
            
            const res = await api.post('/hunting/suggestions', {
                originalQuestion: originalQ,
                resultSummary: `Found ${resultData.length} events`,
                topValues
            });
            
            if (res.data.success && res.data.data.suggestions) {
                setAiSuggestions(res.data.data.suggestions);
            }
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Save Query
    const handleSaveQuery = () => {
        if (!queryName.trim()) return;
        
        const newQuery: SavedQuery = {
            id: Date.now().toString(),
            name: queryName,
            query: activeTab === 'ai' ? naturalQuery : query,
            type: activeTab === 'ai' ? 'natural' : 'sql',
            createdAt: new Date().toISOString()
        };
        
        const updated = [...savedQueries, newQuery];
        setSavedQueries(updated);
        localStorage.setItem('hunting_saved_queries', JSON.stringify(updated));
        setQueryName("");
        onClose();
    };

    // Load saved query
    const handleLoadQuery = (saved: SavedQuery) => {
        if (saved.type === 'natural') {
            setNaturalQuery(saved.query);
            setActiveTab('ai');
        } else {
            setQuery(saved.query);
            setActiveTab('sql');
        }
        setShowSavedQueries(false);
    };

    // Delete saved query
    const handleDeleteQuery = (id: string) => {
        const updated = savedQueries.filter(q => q.id !== id);
        setSavedQueries(updated);
        localStorage.setItem('hunting_saved_queries', JSON.stringify(updated));
    };

    const exampleQuestions = [
        "หา Login ล้มเหลวมากกว่า 5 ครั้งจาก IP เดียวกัน",
        "แสดง Event ที่มี Severity เป็น Critical หรือ High",
        "ค้นหา Process ที่รัน powershell.exe หรือ cmd.exe",
        "หาการเชื่อมต่อไปยัง Port 4444,5555,6666 (Reverse Shell)",
        "แสดง User ที่ถูก Disable หรือ Lockout",
        "ค้นหาไฟล์ที่มี .exe หรือ .dll ถูกสร้างใหม่",
        "หา RDP connections จาก IP ภายนอก",
        "แสดง Events ที่เกี่ยวกับ mimikatz, psexec, cobalt",
        "ค้นหาการ Copy ไฟล์ไปยัง USB หรือ External Drive",
        "หา Data transfer มากกว่า 100MB ในช่วง 24 ชม.",
    ];

    const renderChart = () => {
        if (chartType === 'timeline') {
            return (
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="time" stroke="#888" fontSize={11} />
                        <YAxis stroke="#888" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === 'pie') {
            return (
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        >
                            {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        // Default: Bar chart
        return (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" fontSize={11} />
                    <YAxis dataKey="name" type="category" width={120} stroke="#888" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-6">
            {/* Header with Time Range */}
            <div className="flex justify-between items-center mb-2 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Icon.Search className="w-8 h-8 text-primary" />
                        Threat Hunting
                    </h1>
                    <p className="text-foreground/60 mt-1">Proactive threat search using AI, SQL, or Sigma Rules</p>
                </div>
                
                {/* Time Range & Saved Queries */}
                <div className="flex items-center gap-3">
                    <Select
                        size="sm"
                        label="Time Range"
                        selectedKeys={[timeRange]}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="w-40"
                    >
                        {TIME_RANGES.map(r => (
                            <SelectItem key={r.key}>{r.label}</SelectItem>
                        ))}
                    </Select>
                    
                    <Button 
                        size="sm" 
                        variant="flat" 
                        startContent={<Icon.Clock className="w-4 h-4" />}
                        onPress={() => { setShowHistory(!showHistory); setShowSavedQueries(false); }}
                    >
                        History ({queryHistory.length})
                    </Button>
                    
                    <Button 
                        size="sm" 
                        variant="flat" 
                        startContent={<Icon.Folder className="w-4 h-4" />}
                        onPress={() => { setShowSavedQueries(!showSavedQueries); setShowHistory(false); }}
                    >
                        Saved ({savedQueries.length})
                    </Button>
                </div>
            </div>

            {/* Query History Panel */}
            {showHistory && queryHistory.length > 0 && (
                <Card className="bg-content2/50 border border-white/5">
                    <CardBody className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <Icon.Clock className="w-4 h-4" /> Query History
                            </h4>
                            <div className="flex gap-2">
                                <Button size="sm" variant="light" color="danger" onPress={handleClearHistory}>
                                    Clear All
                                </Button>
                                <Button size="sm" variant="light" isIconOnly onPress={() => setShowHistory(false)}>
                                    <Icon.Close className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {queryHistory.slice(0, 10).map(item => (
                                <div 
                                    key={item.id} 
                                    className="flex items-center justify-between p-2 bg-black/20 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                                    onClick={() => handleLoadFromHistory(item)}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-lg">
                                            {item.type === 'natural' ? '🤖' : item.type === 'sigma' ? '📜' : '💻'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-mono truncate">{item.query.slice(0, 60)}{item.query.length > 60 ? '...' : ''}</p>
                                            <p className="text-xs text-foreground/50">
                                                {item.resultCount} rows • {new Date(item.executedAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                    <Chip size="sm" variant="flat" color="primary">{item.resultCount}</Chip>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Saved Queries Panel */}
            {showSavedQueries && savedQueries.length > 0 && (
                <Card className="bg-content2/50 border border-white/5">
                    <CardBody className="p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-sm">Saved Queries</h4>
                            <Button size="sm" variant="light" isIconOnly onPress={() => setShowSavedQueries(false)}>
                                <Icon.Close className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {savedQueries.map(sq => (
                                <Chip 
                                    key={sq.id} 
                                    variant="flat" 
                                    className="cursor-pointer hover:bg-primary/20"
                                    onClose={() => handleDeleteQuery(sq.id)}
                                    onClick={() => handleLoadQuery(sq)}
                                >
                                    {sq.type === 'natural' ? '🤖' : '💻'} {sq.name}
                                </Chip>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            <Card className="bg-content1 border border-white/5">
                <CardBody className="p-6">
                    <Tabs aria-label="Hunting Modes" color="primary" variant="underlined" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
                        <Tab key="ai" title={<div className="flex items-center gap-2"><Icon.Cpu className="w-4 h-4"/> Ask AI</div>}>
                            <div className="mt-4 space-y-4">
                                <div className="relative">
                                    <Textarea 
                                        label="ถามคำถามเป็นภาษาธรรมชาติ (ไทย/English)"
                                        placeholder="เช่น: หา Login ที่ล้มเหลวในช่วง 24 ชั่วโมง, แสดง Event ที่มี Severity เป็น Critical..."
                                        minRows={3}
                                        maxRows={5}
                                        value={naturalQuery}
                                        onValueChange={setNaturalQuery}
                                        classNames={{
                                            input: "text-lg",
                                            inputWrapper: "bg-content2/50 border border-white/10"
                                        }}
                                    />
                                </div>
                                
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-xs text-foreground/40">ตัวอย่าง:</span>
                                    {exampleQuestions.map((q, i) => (
                                        <Chip 
                                            key={i} 
                                            size="sm" 
                                            variant="flat" 
                                            className="cursor-pointer hover:bg-primary/20 transition-colors"
                                            onClick={() => setNaturalQuery(q)}
                                        >
                                            {q}
                                        </Chip>
                                    ))}
                                </div>

                                {generatedSql && (
                                    <div className="p-4 bg-black/30 rounded-lg border border-white/5">
                                        <p className="text-xs text-foreground/40 mb-2 font-semibold uppercase tracking-wider flex items-center gap-2">
                                            <Icon.Zap className="w-3 h-3 text-warning" />
                                            AI Generated SQL:
                                        </p>
                                        <code className="text-sm text-success font-mono block whitespace-pre-wrap">{generatedSql}</code>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <Button 
                                        size="sm" 
                                        variant="flat"
                                        startContent={<Icon.Folder className="w-4 h-4" />}
                                        onPress={onOpen}
                                        isDisabled={!naturalQuery.trim()}
                                    >
                                        Save Query
                                    </Button>
                                    <Button 
                                        color="primary" 
                                        size="lg"
                                        endContent={<Icon.Zap className="w-4 h-4"/>} 
                                        onPress={handleAskAI} 
                                        isLoading={loading}
                                        className="font-semibold"
                                    >
                                        Search with AI
                                    </Button>
                                </div>
                            </div>
                        </Tab>
                        <Tab key="sql" title={<div className="flex items-center gap-2"><Icon.Terminal className="w-4 h-4"/> SQL Logic</div>}>
                            <div className="mt-4 space-y-4">
                                <Textarea 
                                    label="SQL Query (ClickHouse)"
                                    placeholder="SELECT * FROM security_events..."
                                    minRows={5}
                                    value={query}
                                    onValueChange={setQuery}
                                    classNames={{ 
                                        input: "font-mono",
                                        inputWrapper: "bg-content2/50" 
                                    }}
                                />
                                <div className="flex justify-between items-center">
                                    <Button 
                                        size="sm" 
                                        variant="flat"
                                        startContent={<Icon.Folder className="w-4 h-4" />}
                                        onPress={onOpen}
                                        isDisabled={!query.trim()}
                                    >
                                        Save Query
                                    </Button>
                                    <Button color="primary" endContent={<Icon.Zap className="w-4 h-4"/>} onPress={() => handleRunQuery()} isLoading={loading}>
                                        Run Query
                                    </Button>
                                </div>
                            </div>
                        </Tab>
                        <Tab key="sigma" title={<div className="flex items-center gap-2"><Icon.Shield className="w-4 h-4"/> Sigma Rule</div>}>
                            <div className="mt-4 space-y-4">
                                <Textarea 
                                    label="Sigma YAML"
                                    placeholder="Paste Sigma Rule here..."
                                    minRows={10}
                                    value={sigmaYaml}
                                    onValueChange={setSigmaYaml}
                                    classNames={{ 
                                        input: "font-mono",
                                        inputWrapper: "bg-content2/50"
                                    }}
                                />
                                {generatedSql && activeTab === 'sigma' && (
                                    <div className="p-4 bg-black/30 rounded-lg border border-white/5">
                                        <p className="text-xs text-foreground/40 mb-2 font-semibold uppercase tracking-wider">Generated SQL:</p>
                                        <code className="text-sm text-success font-mono block whitespace-pre-wrap">{generatedSql}</code>
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <Button color="secondary" endContent={<Icon.Zap className="w-4 h-4"/>} onPress={handleRunSigma} isLoading={loading}>
                                        Convert & Run
                                    </Button>
                                </div>
                            </div>
                        </Tab>
                    </Tabs>

                    {error && (
                        <div className="mt-4 p-4 bg-danger/10 border border-danger/20 text-danger rounded-lg flex items-center gap-3">
                            <Icon.AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">Error: {error}</p>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Results Section */}
            <Card className="bg-content1 border border-white/5 min-h-[400px]">
                <CardBody className="p-6">
                    <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-xl">Query Results</h3>
                            <Chip size="sm" variant="flat" color="primary">{results.length} rows</Chip>
                        </div>
                        
                        {results.length > 0 && (
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Export CSV Button */}
                                <Button 
                                    size="sm" 
                                    variant="flat" 
                                    startContent={<Icon.Download className="w-4 h-4" />}
                                    onPress={handleExportCSV}
                                >
                                    Export CSV
                                </Button>
                                
                                {/* View Toggle */}
                                <ButtonGroup size="sm" variant="flat">
                                    <Button 
                                        color={viewMode === 'table' ? 'primary' : 'default'} 
                                        onPress={() => setViewMode('table')}
                                        startContent={<Icon.Document className="w-4 h-4" />}
                                    >
                                        Table
                                    </Button>
                                    <Button 
                                        color={viewMode === 'chart' ? 'primary' : 'default'} 
                                        onPress={() => setViewMode('chart')}
                                        startContent={<Icon.Chart className="w-4 h-4" />}
                                    >
                                        Chart
                                    </Button>
                                </ButtonGroup>
                                
                                {/* Chart Options */}
                                {viewMode === 'chart' && (
                                    <div className="flex items-center gap-2">
                                        <Select 
                                            size="sm" 
                                            label="Chart Type"
                                            selectedKeys={[chartType]}
                                            onChange={(e) => setChartType(e.target.value as any)}
                                            className="w-32"
                                        >
                                            <SelectItem key="bar">Bar</SelectItem>
                                            <SelectItem key="pie">Pie</SelectItem>
                                            <SelectItem key="timeline">Timeline</SelectItem>
                                        </Select>
                                        
                                        {chartType !== 'timeline' && aggregatableFields.length > 0 && (
                                            <Select 
                                                size="sm" 
                                                label="Group By"
                                                selectedKeys={[chartField]}
                                                onChange={(e) => setChartField(e.target.value)}
                                                className="w-36"
                                            >
                                                {aggregatableFields.map(field => (
                                                    <SelectItem key={field}>{field}</SelectItem>
                                                ))}
                                            </Select>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-4">
                            <Spinner color="primary" />
                            <p className="text-sm text-foreground/60 animate-pulse">
                                {activeTab === 'ai' ? 'AI is analyzing your question...' : 'Executing Query...'}
                            </p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-foreground/40 gap-3">
                            <Icon.Search className="w-12 h-12 opacity-20" />
                            <p className="font-medium">No results found or query not run yet.</p>
                        </div>
                    ) : viewMode === 'chart' ? (
                        <div className="py-4">
                            {renderChart()}
                        </div>
                    ) : (
                        <div className="overflow-x-auto scrollbar-thin">
                            <Table aria-label="Query Results" removeWrapper className="bg-transparent" shadow="none">
                                <TableHeader>
                                    {columns.map(col => (
                                        <TableColumn key={col} className="bg-content2/50 uppercase text-xs font-bold tracking-wider">{col}</TableColumn>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {results.map((row, idx) => (
                                        <TableRow key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                            {columns.map(col => (
                                                <TableCell key={`${idx}-${col}`} className="py-4 text-sm font-mono text-foreground/80">
                                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Save Query Modal */}
            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalContent>
                    <ModalHeader>Save Query</ModalHeader>
                    <ModalBody>
                        <Input
                            label="Query Name"
                            placeholder="e.g., Failed Logins Last 24h"
                            value={queryName}
                            onValueChange={setQueryName}
                        />
                        <p className="text-xs text-foreground/50 mt-2">
                            Query will be saved locally in your browser.
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>Cancel</Button>
                        <Button color="primary" onPress={handleSaveQuery} isDisabled={!queryName.trim()}>
                            Save
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* AI Follow-up Suggestions */}
            {(aiSuggestions.length > 0 || loadingSuggestions) && activeTab === 'ai' && (
                <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
                    <CardBody className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Icon.Cpu className="w-4 h-4 text-primary" />
                            <h4 className="font-semibold text-sm">AI แนะนำคำถามต่อเนื่อง</h4>
                            {loadingSuggestions && <Spinner size="sm" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {aiSuggestions.map((suggestion, i) => (
                                <Chip 
                                    key={i}
                                    variant="flat"
                                    color="primary"
                                    className="cursor-pointer hover:bg-primary/30 transition-colors"
                                    onClick={() => {
                                        setNaturalQuery(suggestion);
                                        setAiSuggestions([]);
                                    }}
                                >
                                    💡 {suggestion}
                                </Chip>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* AI Footer */}
            <div className="flex items-center justify-center gap-2 py-4">
                <Icon.CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs text-foreground/40 font-medium">
                    AI-Powered Threat Engine Monitoring Active
                </span>
            </div>
        </div>
    );
}
