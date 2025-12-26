import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { MdrPageFooter } from './MdrPageFooter'

// Threat Classification Categories
interface ThreatClassification {
  Malware: number
  Ransomware: number
  Cryptominer: number
  Packed: number
  General: number
  Exploit: number
}

interface OverviewData {
  threats: number
  mitigated: number
  malicious: number
  suspicious: number
  benign: number
  notMitigated: number
  classification?: ThreatClassification  // 🔥 New: Threat category breakdown
}

interface MdrOverviewSectionProps {
  overview: OverviewData
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
  classifications: Array<{ name: string; count: number }>
}

// 🎨 Category Colors for Pie Chart
const CATEGORY_COLORS: Record<string, string> = {
  Malware: '#F97316',    // Orange (Common)
  Ransomware: '#DC2626', // Red (Critical)
  Cryptominer: '#A855F7',// Purple
  Packed: '#EAB308',     // Yellow (Suspicious)
  Exploit: '#EF4444',    // Red-Light
  General: '#3B82F6',    // Blue (Low risk)
}


/**
 * Overview Incident Report Section
 * Contains bar chart and top endpoints/threats lists
 */
export function MdrOverviewSection({ overview, topEndpoints, classifications }: MdrOverviewSectionProps) {
  // Debug logging
  console.log('📊 MdrOverviewSection received props:', { overview, classifications })
  
  // Chart 1: Incident Overview (Bar)
  const barChartData = [
    { name: 'THREATS', value: overview.threats, color: '#9ca3af' }, // Grey
    { name: 'SUSPICIOUS', value: overview.suspicious, color: '#10b981' }, // Green (from screenshot look)
    { name: 'MALICIOUS', value: overview.malicious, color: '#ef4444' }, // Red
    { name: 'MITIGATED', value: overview.mitigated, color: '#f59e0b' }, // Yellow
    { name: 'BENIGN', value: overview.benign, color: '#9ca3af' }, // Grey
    { name: 'NOT MITIGATED', value: overview.notMitigated, color: '#0ea5e9' }, // Blue
  ]
  
  // 🔥 Chart 2: Classification Pie Data (from overview.classification)
  const pieData = overview.classification ? [
    { name: 'Malware', value: overview.classification.Malware || 0, color: CATEGORY_COLORS.Malware },
    { name: 'Ransomware', value: overview.classification.Ransomware || 0, color: CATEGORY_COLORS.Ransomware },
    { name: 'Cryptominer', value: overview.classification.Cryptominer || 0, color: CATEGORY_COLORS.Cryptominer },
    { name: 'Packed', value: overview.classification.Packed || 0, color: CATEGORY_COLORS.Packed },
    { name: 'Exploit', value: overview.classification.Exploit || 0, color: CATEGORY_COLORS.Exploit },
    { name: 'General', value: overview.classification.General || 0, color: CATEGORY_COLORS.General },
  ].filter(d => d.value > 0) : []  // Hide categories with 0 count
  
  console.log('📊 barChartData:', barChartData)
  console.log('📊 pieData:', pieData)
  
  return (
    <>
      {/* Page 1: Incident Overview Bar Chart */}
      <div className="mdr-page mdr-overview-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">1. Executive Overview</h1>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-8 flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
              Security Incidents Summary
            </h2>
            
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Overview Incident Report</h3>
              <div className="w-full flex justify-center">
                <ResponsiveContainer width={700} height={250}>
                  <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 50, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11}} />
                    <Tooltip formatter={(value: number) => [value, 'Count']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={25} label={{ position: 'right', fontSize: 8, fill: '#374151' }}>
                      {barChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={barChartData[index].color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
               {/* Summary Stats */}
              <div className="grid grid-cols-6 gap-4 mt-8">
                {barChartData.map((item, index) => (
                  <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold" style={{ color: item.color }}>
                      {item.value}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <MdrPageFooter />
        </div>
      </div>

      {/* Page 2: Top Classification Pie Chart */}
      <div className="mdr-page mdr-classification-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">1.1 Top Classifications</h1>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-8">
             <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-2">
               Incident Classification
             </h2>

             <div className="w-full flex flex-col items-center">
                 {pieData && pieData.length > 0 ? (
                   <>
                     <ResponsiveContainer width={700} height={320}>
                         <PieChart>
                           <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, value, percent }: any) => `${name}, ${value}, ${((percent || 0) * 100).toFixed(0)}%`}
                              outerRadius={120}
                              fill="#8884d8"
                              dataKey="value"
                              isAnimationActive={false}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                           <Legend verticalAlign="bottom" height={36}/>
                           <Tooltip />
                         </PieChart>
                     </ResponsiveContainer>
                     {/* Total Analyzed Threats */}
                     <div className="text-center mt-4">
                       <span className="text-sm text-gray-500">Total Analyzed Threats: </span>
                       <span className="font-bold text-gray-800">
                         {pieData.reduce((a, b) => a + b.value, 0)}
                       </span>
                     </div>
                   </>
                 ) : (
                   <div className="flex items-center justify-center text-gray-400 italic border border-dashed border-gray-300 w-full h-64 rounded-lg">
                     No classification data available
                   </div>
                 )}
              </div>
          </div>
          
          {/* Footer */}
          <MdrPageFooter />
        </div>
      </div>
      
      {/* Page 3: Top Endpoints & Threats */}
      <div className="mdr-page mdr-top-incidents-page">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-lime-500 text-white py-4 px-8">
            <h1 className="text-2xl font-bold">1.2 Top Incidents</h1>
          </div>

          <div className="flex-1 p-8">
            <div className="grid grid-cols-2 gap-12 h-full">
              {/* Top Endpoints */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                  Top Endpoints by Incidents
                </h3>
                 {topEndpoints.length === 0 ? (
                    <p className="text-gray-500 italic">No incidents recorded for endpoints.</p>
                  ) : (
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {topEndpoints.map((endpoint, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm text-gray-900">{endpoint.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{endpoint.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>

              {/* Top Classification */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                  Top Classification
                </h3>
                {pieData.length === 0 ? (
                    <p className="text-gray-500 italic">No classification data available.</p>
                  ) : (
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pieData.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm text-gray-900 flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <MdrPageFooter />
        </div>
      </div>
    </>
  )
}
