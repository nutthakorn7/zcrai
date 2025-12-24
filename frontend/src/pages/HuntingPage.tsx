import { useState } from 'react';
import { Card, CardBody, Button, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tabs, Tab, Chip, Spinner } from "@heroui/react";
import { Icon } from '../shared/ui';
import { api } from '../shared/api/api';

export default function HuntingPage() {
    const [activeTab, setActiveTab] = useState("sql");
    const [query, setQuery] = useState("SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 20");
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

    const handleRunQuery = async () => {
        setLoading(true);
        setError("");
        setResults([]);
        try {
            const res = await api.post('/hunting/query', { query });
            if (res.data.success) {
                const data = res.data.data;
                setResults(data);
                if (data.length > 0) {
                    setColumns(Object.keys(data[0]));
                }
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
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Icon.Search className="w-8 h-8 text-primary" />
                        Threat Hunting
                    </h1>
                    <p className="text-foreground/60 mt-1">Proactive threat search using SQL or Sigma Rules</p>
                </div>
            </div>

            <Card className="bg-content1 border border-white/5">
                <CardBody className="p-6">
                    <Tabs aria-label="Hunting Modes" color="primary" variant="underlined" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
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
                                <div className="flex justify-end">
                                    <Button color="primary" endContent={<Icon.Zap className="w-4 h-4"/>} onPress={handleRunQuery} isLoading={loading}>
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
                                {generatedSql && (
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

            {/* Results Table */}
            <Card className="bg-content1 border border-white/5 min-h-[400px]">
                <CardBody className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl">Query Results</h3>
                        <Chip size="sm" variant="flat" color="primary">{results.length} rows</Chip>
                    </div>
                    
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-64 gap-4">
                            <Spinner color="primary" />
                            <p className="text-sm text-foreground/60 animate-pulse">Executing Query...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-foreground/40 gap-3">
                            <Icon.Search className="w-12 h-12 opacity-20" />
                            <p className="font-medium">No results found or query not run yet.</p>
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
