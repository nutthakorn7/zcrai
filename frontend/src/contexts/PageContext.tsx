import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ==================== TYPES ====================
interface PageContextData {
  pageName: string
  pageDescription: string
  data: Record<string, any>
}

interface PageContextType {
  pageContext: PageContextData
  setPageContext: (context: PageContextData) => void
  updatePageData: (key: string, value: any) => void
  getContextSummary: () => string
}

// ==================== DEFAULT VALUES ====================
const defaultContext: PageContextData = {
  pageName: 'Unknown',
  pageDescription: '',
  data: {}
}

// ==================== CONTEXT ====================
const PageContext = createContext<PageContextType | undefined>(undefined)

// ==================== PROVIDER ====================
export const PageContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pageContext, setPageContextState] = useState<PageContextData>(defaultContext)

  const setPageContext = useCallback((context: PageContextData) => {
    setPageContextState(context)
  }, [])

  const updatePageData = useCallback((key: string, value: any) => {
    setPageContextState(prev => ({
      ...prev,
      data: { ...prev.data, [key]: value }
    }))
  }, [])

  // สร้าง Summary สำหรับส่งให้ AI
  const getContextSummary = useCallback((): string => {
    const { pageName, pageDescription, data } = pageContext
    
    let summary = `## Current Page: ${pageName}\n`
    if (pageDescription) {
      summary += `${pageDescription}\n\n`
    }

    // Format data based on page type
    if (pageName === 'Dashboard') {
      if (data.stats) {
        summary += `### Security Statistics:\n`
        summary += `- Total Events: ${data.stats.totalEvents || 0}\n`
        summary += `- Critical Alerts: ${data.stats.criticalAlerts || 0}\n`
        summary += `- High Alerts: ${data.stats.highAlerts || 0}\n`
        summary += `- Medium Alerts: ${data.stats.mediumAlerts || 0}\n`
        summary += `- Low Alerts: ${data.stats.lowAlerts || 0}\n`
      }
      if (data.topThreats && data.topThreats.length > 0) {
        summary += `\n### Top Threats:\n`
        data.topThreats.slice(0, 5).forEach((t: any, i: number) => {
          summary += `${i + 1}. ${t.name || t.type}: ${t.count} occurrences\n`
        })
      }
      if (data.recentAlerts && data.recentAlerts.length > 0) {
        summary += `\n### Recent Alerts (last 5):\n`
        data.recentAlerts.slice(0, 5).forEach((a: any, i: number) => {
          summary += `${i + 1}. [${a.severity}] ${a.title || a.type} - ${a.timestamp || ''}\n`
        })
      }
    }

    if (pageName === 'Log Viewer') {
      if (data.totalLogs !== undefined) {
        summary += `### Log Statistics:\n`
        summary += `- Total Logs: ${data.totalLogs}\n`
        summary += `- Current Page: ${data.currentPage} of ${data.totalPages || 1}\n`
        summary += `- Logs Per Page: ${data.logsPerPage || 20}\n`
        summary += `- Active Filters: ${data.currentFilter || 'None'}\n`
      }
      if (data.severityBreakdown && Object.keys(data.severityBreakdown).length > 0) {
        summary += `\n### Severity Breakdown (visible logs):\n`
        Object.entries(data.severityBreakdown).forEach(([sev, count]) => {
          summary += `- ${sev}: ${count}\n`
        })
      }
      if (data.uniqueSources && data.uniqueSources.length > 0) {
        summary += `\n### Sources: ${data.uniqueSources.join(', ')}\n`
      }
      if (data.uniqueHosts && data.uniqueHosts.length > 0) {
        summary += `### Hosts: ${data.uniqueHosts.slice(0, 5).join(', ')}${data.uniqueHosts.length > 5 ? '...' : ''}\n`
      }
      if (data.uniqueUsers && data.uniqueUsers.length > 0) {
        summary += `### Users: ${data.uniqueUsers.slice(0, 5).join(', ')}${data.uniqueUsers.length > 5 ? '...' : ''}\n`
      }
      if (data.logs && data.logs.length > 0) {
        summary += `\n### Log Details (first ${Math.min(data.logs.length, 20)}):\n`
        data.logs.slice(0, 20).forEach((log: any, i: number) => {
          summary += `${i + 1}. [${log.severity?.toUpperCase()}] ${log.type || 'Unknown'}\n`
          if (log.title) summary += `   Title: ${log.title}\n`
          if (log.description) summary += `   Desc: ${log.description}\n`
          if (log.host) summary += `   Host: ${log.host}${log.ip ? ` (${log.ip})` : ''}\n`
          if (log.user) summary += `   User: ${log.user}\n`
          if (log.mitre_tactic) summary += `   MITRE: ${log.mitre_tactic}${log.mitre_technique ? ` / ${log.mitre_technique}` : ''}\n`
          if (log.integration) summary += `   Integration: ${log.integration}\n`
          if (log.timestamp) summary += `   Time: ${log.timestamp}\n`
        })
      }
    }

    if (pageName === 'Settings' || pageName === 'Integrations') {
      if (data.integrations && data.integrations.length > 0) {
        summary += `### Configured Integrations:\n`
        data.integrations.forEach((int: any, i: number) => {
          summary += `${i + 1}. ${int.name || int.type} - Status: ${int.status || 'Unknown'}\n`
        })
      }
      if (data.aiProviders && data.aiProviders.length > 0) {
        summary += `\n### AI Providers:\n`
        data.aiProviders.forEach((ai: any, i: number) => {
          summary += `${i + 1}. ${ai.provider} (${ai.model || 'default model'})\n`
        })
      }
    }

    // Generic data fallback
    if (Object.keys(data).length > 0 && !['Dashboard', 'Log Viewer', 'Settings', 'Integrations'].includes(pageName)) {
      summary += `\n### Page Data:\n`
      summary += JSON.stringify(data, null, 2).slice(0, 2000) // Limit to 2000 chars
    }

    return summary
  }, [pageContext])

  return (
    <PageContext.Provider value={{ pageContext, setPageContext, updatePageData, getContextSummary }}>
      {children}
    </PageContext.Provider>
  )
}

// ==================== HOOK ====================
export const usePageContext = (): PageContextType => {
  const context = useContext(PageContext)
  if (!context) {
    throw new Error('usePageContext must be used within a PageContextProvider')
  }
  return context
}

export default PageContext
