// @ts-nocheck
import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { api } from '../../shared/api/api';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

interface CustomWidgetProps {
  widgetId: string;
  className?: string;
}

export default function CustomWidget({ widgetId, className }: CustomWidgetProps) {
  const [widget, setWidget] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWidget = async () => {
      try {
        // Get widget config
        const widgetRes = await api.get(`/widgets/${widgetId}`);
        const w = widgetRes.data.data;
        setWidget(w);

        // Execute query
        const dataRes = await api.post('/widgets/query', w.config);
        setData(dataRes.data.data || []);
      } catch (e) {
        console.error('Failed to load custom widget:', e);
      } finally {
        setLoading(false);
      }
    };
    loadWidget();
  }, [widgetId]);

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (!widget) {
    return (
      <div className={`h-full flex items-center justify-center text-default-500 ${className}`}>
        Widget not found
      </div>
    );
  }

  const renderChart = () => {
    if (data.length === 0) {
      return <div className="h-full flex items-center justify-center text-default-400">No data</div>;
    }

    switch (widget.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={widget.chartType === 'donut' ? 30 : 0}
                outerRadius={50}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      
      case 'table':
        return (
          <div className="overflow-auto h-full text-xs">
            <table className="w-full">
              <thead className="bg-content2/50 sticky top-0">
                <tr>
                  <th className="p-1 text-left">Name</th>
                  <th className="p-1 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="p-1">{row.name}</td>
                    <td className="p-1 text-right font-mono">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="text-xs font-medium text-default-600 mb-1 truncate">
        {widget.name}
      </div>
      <div className="flex-1 min-h-0">
        {renderChart()}
      </div>
    </div>
  );
}
