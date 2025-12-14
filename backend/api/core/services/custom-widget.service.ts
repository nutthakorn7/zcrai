import { db } from '../../infra/db';
import { customWidgets } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';
import { DashboardService } from './dashboard.service';

export interface WidgetConfig {
  metric: 'events' | 'alerts';
  aggregation: 'count' | 'unique';
  groupBy: 'severity' | 'source' | 'host' | 'user' | 'day';
  timeRange: '1d' | '7d' | '30d' | '90d';
  filters?: {
    severity?: string[];
    source?: string[];
  };
}

export interface CreateWidgetInput {
  name: string;
  description?: string;
  config: WidgetConfig;
  chartType: 'bar' | 'line' | 'pie' | 'donut' | 'table';
}

export const CustomWidgetService = {
  /**
   * Execute a query based on widget config (for preview)
   */
  async executeQuery(tenantId: string, config: WidgetConfig) {
    const { timeRange, groupBy, metric } = config;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    startDate.setDate(endDate.getDate() - days);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Use existing dashboard service methods based on groupBy
    switch (groupBy) {
      case 'severity':
        const summary = await DashboardService.getSummary(tenantId, startStr, endStr);
        return Object.entries(summary)
          .filter(([key]) => key !== 'total')
          .map(([name, value]) => ({ name, value }));
      
      case 'source':
        const sources = await DashboardService.getSourcesBreakdown(tenantId, startStr, endStr);
        return sources.map((s: any) => ({ name: s.source, value: parseInt(s.count) }));
      
      case 'host':
        const hosts = await DashboardService.getTopHosts(tenantId, startStr, endStr, 10);
        return hosts.map((h: any) => ({ name: h.host_name, value: parseInt(h.count) }));
      
      case 'user':
        const users = await DashboardService.getTopUsers(tenantId, startStr, endStr, 10);
        return users.map((u: any) => ({ name: u.user_name, value: parseInt(u.count) }));
      
      case 'day':
        const timeline = await DashboardService.getTimeline(tenantId, startStr, endStr, 'day');
        // Aggregate by date
        const byDay: Record<string, number> = {};
        timeline.forEach((t: any) => {
          const day = t.time.split('T')[0];
          byDay[day] = (byDay[day] || 0) + parseInt(t.count);
        });
        return Object.entries(byDay).map(([name, value]) => ({ name, value }));
      
      default:
        return [];
    }
  },

  /**
   * Create a custom widget
   */
  async create(userId: string, tenantId: string, input: CreateWidgetInput) {
    const [widget] = await db.insert(customWidgets).values({
      userId,
      tenantId,
      name: input.name,
      description: input.description,
      config: input.config,
      chartType: input.chartType,
    }).returning();
    
    return widget;
  },

  /**
   * List user's custom widgets
   */
  async list(userId: string, tenantId: string) {
    return await db.select()
      .from(customWidgets)
      .where(and(
        eq(customWidgets.userId, userId),
        eq(customWidgets.tenantId, tenantId)
      ));
  },

  /**
   * Get widget by ID
   */
  async getById(id: string, tenantId: string) {
    const [widget] = await db.select()
      .from(customWidgets)
      .where(and(
        eq(customWidgets.id, id),
        eq(customWidgets.tenantId, tenantId)
      ));
    return widget;
  },

  /**
   * Delete widget
   */
  async delete(id: string, userId: string) {
    await db.delete(customWidgets)
      .where(and(
        eq(customWidgets.id, id),
        eq(customWidgets.userId, userId)
      ));
  }
};
