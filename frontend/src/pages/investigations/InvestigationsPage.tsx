import { useState } from 'react';
import { Card, CardBody, Button, Select, SelectItem } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { SankeyDiagram } from '../../components/charts/SankeyDiagram';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { StatCard } from '../../shared/ui/StatCard';
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
    stats: { escalated: 0, notEscalated: 0, determinationBreakdown: {}, timeSavedHours: 0 } 
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            label="Escalated Alerts" 
            value={stats?.escalated || 0} 
            className="border-l-4 border-l-danger"
          />
          <StatCard 
            label="Not Escalated" 
            value={stats?.notEscalated || 0} 
            className="border-l-4 border-l-default"
          />
          <StatCard 
            label="Malicious Verdicts" 
            value={stats?.determinationBreakdown?.['Malicious'] || 0} 
            className="border-l-4 border-l-danger"
          />
          <StatCard 
            label="Est. Time Saved" 
            value={`${stats?.timeSavedHours || 0}h`} 
            className="border-l-4 border-l-success"
          />
      </div>
    </div>
  );
}

// Local StatCard removed in favor of shared component
