import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardBody } from '@heroui/react';

interface DataItem {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

interface DonutCardProps {
  title: string;
  data: DataItem[];
  onSegmentClick?: (name: string) => void;
}

export function DonutCard({ title, data, onSegmentClick }: DonutCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLegend = () => {
    return (
      <div className="flex flex-col gap-1 text-xs">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-300 truncate">{item.name}</span>
            </div>
            <span className="text-white font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-content1/50 border border-white/5">
      <CardBody className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h3>
        
        <div className="flex items-center gap-4">
          {/* Donut Chart */}
          <div className="w-24 h-24 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={48}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(data) => onSegmentClick?.(data.name)}
                  className="cursor-pointer"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0">
            {renderLegend()}
          </div>
        </div>

        {/* Total */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total</span>
            <span className="text-white font-semibold">{total}</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
