import { useState } from 'react';
import { Card, CardBody, Button, Textarea, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tabs, Tab, Chip, Spinner } from "@heroui/react";
import { Search, Play, FileCode, ShieldAlert } from 'lucide-react';
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
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Search className="w-6 h-6 text-primary" />
                        Threat Hunting
                    </h1>
                    <p className="text-gray-400">Proactive threat search using SQL or Sigma Rules</p>
                </div>
            </div>

            <Card className="bg-[#1E1B4B]/30 border border-white/10">
                <CardBody>
                    <Tabs aria-label="Hunting Modes" color="primary" variant="underlined" selectedKey={activeTab} onSelectionChange={(k) => setActiveTab(k as string)}>
                        <Tab key="sql" title={<div className="flex items-center gap-2"><FileCode size={16}/> SQL Logic</div>}>
                            <div className="mt-4 space-y-4">
                                <Textarea 
                                    label="SQL Query (ClickHouse)"
                                    placeholder="SELECT * FROM security_events..."
                                    minRows={5}
                                    value={query}
                                    onValueChange={setQuery}
                                    classNames={{ input: "font-mono" }}
                                />
                                <div className="flex justify-end">
                                    <Button color="primary" endContent={<Play size={16}/>} onPress={handleRunQuery} isLoading={loading}>
                                        Run Query
                                    </Button>
                                </div>
                            </div>
                        </Tab>
                        <Tab key="sigma" title={<div className="flex items-center gap-2"><ShieldAlert size={16}/> Sigma Rule</div>}>
                            <div className="mt-4 space-y-4">
                                <Textarea 
                                    label="Sigma YAML"
                                    placeholder="Paste Sigma Rule here..."
                                    minRows={10}
                                    value={sigmaYaml}
                                    onValueChange={setSigmaYaml}
                                    classNames={{ input: "font-mono" }}
                                />
                                {generatedSql && (
                                    <div className="p-3 bg-black/30 rounded border border-white/10">
                                        <p className="text-xs text-gray-500 mb-1">Generated SQL:</p>
                                        <code className="text-xs text-green-400 font-mono block whitespace-pre-wrap">{generatedSql}</code>
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <Button color="secondary" endContent={<Play size={16}/>} onPress={handleRunSigma} isLoading={loading}>
                                        Convert & Run
                                    </Button>
                                </div>
                            </div>
                        </Tab>
                    </Tabs>

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded">
                            Error: {error}
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Results Table */}
            <Card className="bg-[#1E1B4B]/30 border border-white/10 min-h-[400px]">
                <CardBody>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-lg">Query Results</h3>
                        <Chip size="sm" variant="flat">{results.length} rows</Chip>
                    </div>
                    
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner label="Executing Query..." />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center text-gray-500 py-20">
                            No results found or query not run yet.
                        </div>
                    ) : (
                        <Table aria-label="Query Results" removeWrapper className="bg-transparent">
                            <TableHeader>
                                {columns.map(col => (
                                    <TableColumn key={col}>{col}</TableColumn>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {results.map((row, idx) => (
                                    <TableRow key={idx}>
                                        {columns.map(col => (
                                            <TableCell key={`${idx}-${col}`}>
                                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
