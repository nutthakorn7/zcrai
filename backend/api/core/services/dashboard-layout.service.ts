import { db } from '../../infra/db';
import { dashboardLayouts } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';

// Default layout if none exists
const DEFAULT_LAYOUT = [
    { i: 'overview-stats', x: 0, y: 0, w: 12, h: 4, type: 'stats' },
    { i: 'timeline-chart', x: 0, y: 4, w: 8, h: 6, type: 'chart' },
    { i: 'alerts-feed', x: 8, y: 4, w: 4, h: 6, type: 'feed' }
];

export const DashboardLayoutService = {
  
  /**
   * Get user layout (or default)
   */
  async getLayout(userId: string) {
      const [layout] = await db.select()
          .from(dashboardLayouts)
          .where(and(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.isDefault, true)));
      
      if (layout) return layout;
      
      // Return volatile default structure if no db record found
      return {
          layout: DEFAULT_LAYOUT,
          isDefault: true
      };
  },

  /**
   * Save user layout
   */
  async saveLayout(userId: string, layoutData: any[]) {
      // Upsert logic: Check if exists, update or insert
      // We will assume "one default layout per user" model for now for simplicity
      // Real "Multi-dashboard" support would require Dashboard ID
      
      const [existing] = await db.select()
          .from(dashboardLayouts)
          .where(and(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.isDefault, true)));

      if (existing) {
          const [updated] = await db.update(dashboardLayouts)
              .set({ 
                  layout: layoutData, 
                  updatedAt: new Date() 
              })
              .where(eq(dashboardLayouts.id, existing.id))
              .returning();
          return updated;
      } else {
          const [created] = await db.insert(dashboardLayouts).values({
              userId,
              name: 'My Dashboard',
              layout: layoutData,
              isDefault: true
          }).returning();
          return created;
      }
  },

  /**
   * Reset to System Default
   */
  async resetLayout(userId: string) {
       await db.delete(dashboardLayouts)
          .where(and(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.isDefault, true)));
       return { layout: DEFAULT_LAYOUT };
  }
};
