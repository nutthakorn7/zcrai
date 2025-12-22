import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface OverviewData {
  threats: number
  mitigated: number
  malicious: number
  suspicious: number
  benign: number
  notMitigated: number
}

interface MdrOverviewSectionProps {
  overview: OverviewData
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
}

/**
 * Overview Incident Report Section
 * Contains bar chart and top endpoints/threats lists
 */
export function MdrOverviewSection({ overview, topEndpoints, topThreats }: MdrOverviewSectionProps) {
  // Chart data
  const chartData = [
    { name: 'THREATS', value: overview.threats, color: '#ef4444' },
    { name: 'MITIGATED', value: overview.mitigated, color: '#84cc16' },
    { name: 'MALICIOUS', value: overview.malicious, color: '#f97316' },
    { name: 'SUSPICIOUS', value: overview.suspicious, color: '#eab308' },
    { name: 'BENIGN', value: overview.benign, color: '#22c55e' },
    { name: 'NOT MITIGATED', value: overview.notMitigated, color: '#dc2626' },
  ]
  
  return (
    <>
      {/* Page 1: Chart */}
      <div className="mdr-page mdr-overview-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">1. Overview Incident Report</h1>
          </div>
          
          {/* Chart Section */}
          <div className="flex-1 p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Security Incidents Summary
            </h2>
            
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Count']}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-6 gap-4 mt-8">
              {chartData.map((item, index) => (
                <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold" style={{ color: item.color }}>
                    {item.value}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{item.name}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 text-center text-sm text-gray-400 border-t">
            Page 4
          </div>
        </div>
      </div>
      
      {/* Page 2: Top Endpoints & Threats */}
      <div className="mdr-page mdr-top-incidents-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">1.1 Top Security Incidents</h1>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-8">
            <div className="grid grid-cols-2 gap-8">
              {/* Top Endpoints */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                  Top 10 Endpoints with Threats
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-lime-500">
                      <th className="py-2 text-left text-sm text-gray-600">#</th>
                      <th className="py-2 text-left text-sm text-gray-600">Endpoint</th>
                      <th className="py-2 text-right text-sm text-gray-600">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topEndpoints.slice(0, 10).map((endpoint, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 text-gray-500">{index + 1}</td>
                        <td className="py-2 font-mono text-sm truncate max-w-[200px]">
                          {endpoint.name}
                        </td>
                        <td className="py-2 text-right font-bold text-red-600">
                          {endpoint.count}
                        </td>
                      </tr>
                    ))}
                    {topEndpoints.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Top Threats */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="w-3 h-3 bg-orange-500 rounded-full mr-2" />
                  Top 10 Threat Types
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-lime-500">
                      <th className="py-2 text-left text-sm text-gray-600">#</th>
                      <th className="py-2 text-left text-sm text-gray-600">Threat</th>
                      <th className="py-2 text-right text-sm text-gray-600">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topThreats.slice(0, 10).map((threat, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-2 text-gray-500">{index + 1}</td>
                        <td className="py-2 font-mono text-sm truncate max-w-[200px]">
                          {threat.name}
                        </td>
                        <td className="py-2 text-right font-bold text-orange-600">
                          {threat.count}
                        </td>
                      </tr>
                    ))}
                    {topThreats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">
                          No data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 text-center text-sm text-gray-400 border-t">
            Page 5
          </div>
        </div>
      </div>
    </>
  )
}
