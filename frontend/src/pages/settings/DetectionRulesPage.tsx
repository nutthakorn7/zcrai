import { useEffect, useState } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { DetectionRulesAPI, DetectionRule } from '../../shared/api/detection-rules';

export default function DetectionRulesPage() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [selectedRule, setSelectedRule] = useState<DetectionRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DetectionRule>>({});
  
  // Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const handleTest = async () => {
      if (!editForm.query) return;
      setIsTesting(true);
      setTestResults(null);
      try {
          const res = await DetectionRulesAPI.test(editForm.query);
          setTestResults(res);
      } catch (e) {
          console.error(e);
          setTestResults({ success: false, error: 'Failed to execute test query' });
      } finally {
          setIsTesting(false);
      }
  };

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await DetectionRulesAPI.list();
      setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (rule: DetectionRule) => {
      try {
          const updated = await DetectionRulesAPI.update(rule.id, { isEnabled: !rule.isEnabled });
          setRules(rules.map(r => r.id === rule.id ? updated : r));
      } catch (e) {
          console.error(e);
      }
  };

  const handleEdit = (rule: DetectionRule) => {
      setSelectedRule(rule);
      setEditForm({ ...rule });
      setTestResults(null); // Reset test
      setIsModalOpen(true);
  };

  const handleNewRule = () => {
      setSelectedRule(null);
      setEditForm({
          name: '',
          description: '',
          severity: 'medium',
          isEnabled: true,
          runIntervalSeconds: 3600,
          query: '',
          actions: { group_by: [] }
      });
      setTestResults(null); // Reset test
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      try {
          // Ensure actions object is structured correctly
          const actions = editForm.actions || {};
          
          if (selectedRule) {
              await DetectionRulesAPI.update(selectedRule.id, {
                  ...editForm,
                  actions
              });
          } else {
              await DetectionRulesAPI.create({
                  ...editForm,
                  actions
              });
          }

          fetchRules();
          setIsModalOpen(false);
      } catch (e) {
          console.error(e);
      }
  };

  return (
    <div className="p-6 min-h-screen bg-background space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detection Rules</h2>
          <p className="text-foreground/60">Manage SIGMA-based detection logic and automation</p>
        </div>
        <Button color="primary" onPress={handleNewRule} startContent={<Icon.Add className="w-4 h-4"/>}>New Rule</Button>
      </div>

      <Table aria-label="Detection Rules Table">
        <TableHeader>
          <TableColumn>STATUS</TableColumn>
          <TableColumn>NAME</TableColumn>
          <TableColumn>SEVERITY</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
          <TableColumn>LAST RUN</TableColumn>
          <TableColumn>MANAGE</TableColumn>
        </TableHeader>
        <TableBody items={rules} isLoading={loading}>
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>
                  <Switch size="sm" isSelected={item.isEnabled} onValueChange={() => handleToggle(item)} />
              </TableCell>
              <TableCell>
                  <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-foreground/50">{item.description}</div>
                  </div>
              </TableCell>
              <TableCell>
                  <Chip size="sm" color={
                      item.severity === 'critical' ? 'danger' : 
                      item.severity === 'high' ? 'warning' : 
                      item.severity === 'medium' ? 'secondary' : 'default'
                  } variant="flat" className="capitalize">
                      {item.severity}
                  </Chip>
              </TableCell>
              <TableCell>
                  <div className="flex gap-2">
                       {item.actions?.auto_case && (
                           <Chip size="sm" startContent={<Icon.Cpu className="w-3 h-3"/>} color="primary" variant="flat">Auto-Case</Chip>
                       )}
                  </div>
              </TableCell>
              <TableCell>
                  <span className="text-xs text-foreground/50">
                      {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : 'Never'}
                  </span>
              </TableCell>
              <TableCell>
                  <div className="flex gap-2">
                      <Button isIconOnly size="sm" variant="light" onPress={() => handleEdit(item)}>
                          <Icon.Edit className="w-4 h-4"/>
                      </Button>
                      <Button isIconOnly size="sm" variant="light" color="danger">
                          <Icon.Delete className="w-4 h-4"/>
                      </Button>
                  </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="2xl">
          <ModalContent>
              <ModalHeader>{selectedRule ? 'Edit Detection Rule' : 'Create Detection Rule'}</ModalHeader>
              <ModalBody className="gap-4">
                  <Input label="Name" value={editForm.name} onValueChange={v => setEditForm({...editForm, name: v})} />
                  <Textarea label="Description" value={editForm.description} onValueChange={v => setEditForm({...editForm, description: v})} />
                  
                  <div className="grid grid-cols-2 gap-4">
                      <Select label="Severity" selectedKeys={editForm.severity ? [editForm.severity] : []} onChange={e => setEditForm({...editForm, severity: e.target.value as any})}>
                          <SelectItem key="critical">Critical</SelectItem>
                          <SelectItem key="high">High</SelectItem>
                          <SelectItem key="medium">Medium</SelectItem>
                          <SelectItem key="low">Low</SelectItem>
                      </Select>
                      <Input type="number" label="Interval (Seconds)" value={editForm.runIntervalSeconds?.toString()} onValueChange={v => setEditForm({...editForm, runIntervalSeconds: parseInt(v)})} />
                  </div>

                  <div className="p-4 bg-default-100 rounded-lg space-y-4">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                          <Icon.Cpu className="w-4 h-4 text-warning"/> Automation Actions
                      </h4>
                      
                      {/* Auto Case Toggle */}
                      <div className="flex items-center justify-between">
                          <div>
                              <div className="text-sm">Auto-Create Case</div>
                              <div className="text-xs text-foreground/50">Automatically create a case when this rule triggers</div>
                          </div>
                          <Switch 
                              isSelected={editForm.actions?.auto_case} 
                              onValueChange={v => setEditForm({
                                  ...editForm, 
                                  actions: { ...editForm.actions, auto_case: v }
                              })} 
                          />
                      </div>

                      {/* Grouping Params */}
                      <div className="border-t border-divider pt-4">
                          <div className="text-sm font-medium mb-1">Alert Aggregation (Noise Reduction)</div>
                          <div className="text-xs text-foreground/50 mb-2">Group multiple events into a single alert based on these fields (comma separated). Leave empty for no grouping.</div>
                          <Input 
                            placeholder="e.g. src_ip, user.name" 
                            size="sm"
                            value={(editForm.actions?.group_by as string[])?.join(', ') || ''}
                            onValueChange={v => {
                                const list = v.split(',').map(s => s.trim()).filter(Boolean);
                                setEditForm({
                                    ...editForm,
                                    actions: { ...editForm.actions, group_by: list }
                                });
                            }}
                          />
                      </div>
                  </div>

                  <Textarea 
                    label="Query (SQL)" 
                    classNames={{ input: "font-mono text-xs" }}
                    value={editForm.query} 
                    onValueChange={v => setEditForm({...editForm, query: v})} 
                  />

                  {/* Test Results Section */}
                  {testResults && (
                      <div className="rounded-lg border border-divider p-3 bg-content1/50 text-xs">
                          <div className="flex justify-between items-center mb-2">
                              <span className="font-bold flex items-center gap-2">
                                  {testResults.success ? (
                                      <Icon.CheckCircle className="w-4 h-4 text-success"/>
                                  ) : (
                                      <Icon.Close className="w-4 h-4 text-danger"/>
                                  )}
                                  Test Result: {testResults.success ? `Found ${testResults.count} matches` : 'Error'}
                              </span>
                              {testResults.success && testResults.count > 0 && (
                                  <span className="text-foreground/50">Last 24h</span>
                              )}
                          </div>
                          
                          {!testResults.success ? (
                              <div className="text-danger font-mono p-2 bg-danger/10 rounded">{testResults.error}</div>
                          ) : (
                              testResults.events?.length > 0 && (
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse">
                                          <thead>
                                              <tr className="border-b border-white/10 text-foreground/50">
                                                  <th className="py-1 px-2">Time</th>
                                                  <th className="py-1 px-2">Event</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {testResults.events.slice(0, 3).map((e: any, i: number) => (
                                                  <tr key={i} className="border-b border-white/5 last:border-0">
                                                      <td className="py-1 px-2 whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</td>
                                                      <td className="py-1 px-2 font-mono truncate max-w-[200px]">{JSON.stringify(e).substring(0, 100)}...</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                      {testResults.count > 3 && (
                                          <div className="text-center mt-2 italic text-foreground/50">...and {testResults.count - 3} more</div>
                                      )}
                                  </div>
                              )
                          )}
                      </div>
                  )}

              </ModalBody>
              <ModalFooter>
                  <Button variant="light" onPress={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button variant="flat" color="warning" onPress={handleTest} isLoading={isTesting} startContent={<Icon.Search className="w-4 h-4"/>}>
                      Test Rule
                  </Button>
                  <Button color="primary" onPress={handleSave}>Save Changes</Button>
              </ModalFooter>
          </ModalContent>
      </Modal>
    </div>
  );
}
