import { useState } from 'react';
import { Card, CardBody, Button, Select, SelectItem } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { SankeyDiagram } from '../../components/charts/SankeyDiagram';
import { DonutChart } from '../../components/charts/DonutChart';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { AnalyticsAPI } from '../../shared/api';

export default function InvestigationsPage() {
  const [days, setDays] = useState(7);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['enterprise-insights', days],
    queryFn: async () => {
      const res = await AnalyticsAPI.getInsights(days);
      return res.data;
    }
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center text-white/50">Loading Insights...</div>;
  }

  const { nodes, links, stats } = data || { 
    nodes: [], 
    links: [], 
    stats: { 
      escalated: 0, 
      notEscalated: 0, 
      determinationBreakdown: {}, 
      sourceBreakdown: {},
      timeSavedHours: 0,
      timeSavedMinutes: 0,
      totalAlerts: 0,
      iocStats: { total: 0, enriched: 0, rate: 0 }
    } 
  };

  // Prepare data for donut charts
  const sourceData = Object.entries(stats?.sourceBreakdown || {}).map(([name, value]) => ({
    name,
    value: value as number,
    color: name.includes('Sentinel') ? '#818cf8' : '#f59e0b' // indigo for Sentinel, amber for Defender
  }));

  const determinationColors: Record<string, string> = {
    'Malicious': '#ef4444', // red
    'Suspicious': '#f97316', // orange
    'Review Recommended': '#eab308', // yellow
    'Acceptable Risk': '#a78bfa', // purple
    'Mitigated': '#22c55e', // green
    'Benign': '#6b7280' // gray
  };

  const determinationData = Object.entries(stats?.determinationBreakdown || {}).map(([name, value]) => ({
    name,
    value: value as number,
    color: determinationColors[name] || '#6b7280'
  }));

  return (
    <div className="p-6 h-full flex flex-col gap-6 w-full text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Investigations
          </h1>
          <p className="text-sm mt-1 text-white/60">Comprehensive visualization of threat flow and ROI.</p>
        </div>
        
        <div className="flex items-center gap-3">
             <Select 
                defaultSelectedKeys={[days.toString()]}
                className="w-40"
                size="sm"
                onChange={(e) => setDays(Number(e.target.value))}
             >
                <SelectItem key="1" textValue="Last 24 Hours">Last 24 Hours</SelectItem>
                <SelectItem key="7" textValue="Last 7 Days">Last 7 Days</SelectItem>
                <SelectItem key="30" textValue="Last 30 Days">Last 30 Days</SelectItem>
             </Select>

             <Button isIconOnly variant="flat" size="sm" onPress={() => refetch()}>
                <ArrowPathIcon className="w-4 h-4" />
             </Button>
        </div>
      </div>

      {/* Main Sankey Area */}
      <Card className="flex-grow bg-content1/50 border border-white/5 backdrop-blur-md">
        <CardBody className="p-6 flex flex-col items-center justify-center min-h-[500px]">
           {/* Sankey Chart */}
           <div className="w-full h-[600px]">
              <SankeyDiagram data={{ nodes, links }} />
           </div>

           {/* Labels for Stages */}
           <div className="w-full grid grid-cols-6 text-center mt-4 text-xs text-white/40 uppercase tracking-wider font-semibold">
              <div>Ingestion</div>
              <div>Categorization</div>
              <div>Enrichment</div>
              <div>Agent Triage</div>
              <div>Determination</div>
              <div>Status</div>
           </div>
        </CardBody>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Escalated Alerts */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Escalated Alerts</div>
              <div className="text-4xl font-bold font-display text-danger">{stats?.escalated || 0}</div>
            </CardBody>
          </Card>

          {/* Not Escalated */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Not Escalated</div>
              <div className="text-4xl font-bold font-display text-white/60">{stats?.notEscalated || 0}</div>
            </CardBody>
          </Card>

          {/* Estimated Time Saved */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Estimated Time Saved</div>
              <div className="text-4xl font-bold font-display text-success">
                {stats?.timeSavedHours || 0}h {stats?.timeSavedMinutes || 0}m
              </div>
            </CardBody>
          </Card>

          {/* IOC Enrichment */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Auto-Enrichment</div>
              <div className="text-4xl font-bold font-display text-primary">{stats?.iocStats?.rate || 0}%</div>
              <div className="text-xs text-white/40 mt-1">
                {stats?.iocStats?.enriched || 0} / {stats?.iocStats?.total || 0} IOCs processed
              </div>
            </CardBody>
          </Card>

          {/* Sources (Donut Chart) */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Sources</div>
              <div className="h-48">
                <DonutChart 
                  data={sourceData}
                  centerText="Total Alerts"
                  centerValue={stats?.totalAlerts || 0}
                />
              </div>
              {/* Legend */}
              <div className="mt-4 space-y-1">
                {sourceData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-white/60">{item.name}</span>
                    </div>
                    <span className="text-white/80 font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Agent Determinations (Donut Chart) */}
          <Card className="bg-content1/50 border border-white/5 backdrop-blur-md">
            <CardBody className="p-6">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Agent Determinations</div>
              <div className="h-48">
                <DonutChart 
                  data={determinationData}
                  centerText="Escalated"
                  centerValue={stats?.escalated || 0}
                />
              </div>
              {/* Legend */}
              <div className="mt-4 space-y-1">
                {determinationData.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-white/60">{item.name}</span>
                    </div>
                    <span className="text-white/80 font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
      </div>
    </div>
  );
}
