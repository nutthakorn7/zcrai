import { db } from '../../infra/db';
import { cases, loginHistory, alerts, tenants, users } from '../../infra/db/schema';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';
import { GeoIPService } from './geoip.service';
import { AlertService } from './alert.service';
import { nanoid } from 'nanoid';

export class AnalyticsService {
  /**
   * Get main dashboard metrics
   * @param tenantId Tenant ID
   * @param startDate Start date filter
   * @param endDate End date filter
   */
  async getDashboardMetrics(tenantId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30)); // Default 30 days
    const end = endDate ? new Date(endDate) : new Date();

    const filters = and(
      eq(cases.tenantId, tenantId),
      gte(cases.createdAt, start),
      lte(cases.createdAt, end)
    );

    // 1. Volume by Status
    const statusCounts = await db
      .select({
        status: cases.status,
        count: count(),
      })
      .from(cases)
      .where(filters)
      .groupBy(cases.status);

    // 2. Volume by Severity
    const severityCounts = await db
      .select({
        severity: cases.severity,
        count: count(),
      })
      .from(cases)
      .where(filters)
      .groupBy(cases.severity);

    // 4. Mean Time to Resolve (MTTR)
    const resolvedCases = await db
      .select({
        created: cases.createdAt,
        resolved: cases.resolvedAt,
      })
      .from(cases)
      .where(and(filters, eq(cases.status, 'resolved')));

    let totalDurationMinutes = 0;
    let resolvedCount = 0;

    resolvedCases.forEach(c => {
      if (c.created && c.resolved) {
        const diffMs = c.resolved.getTime() - c.created.getTime();
        totalDurationMinutes += diffMs / (1000 * 60);
        resolvedCount++;
      }
    });

    const mttrHours = resolvedCount > 0 ? (totalDurationMinutes / resolvedCount / 60).toFixed(2) : 0;

    // 5. Volume Over Time (Daily)
    const volumeOverTime = await db
        .select({
            date: sql<string>`DATE(${cases.createdAt})`,
            count: count()
        })
        .from(cases)
        .where(filters)
        .groupBy(sql`DATE(${cases.createdAt})`)
        .orderBy(sql`DATE(${cases.createdAt})`);

    return {
      period: { start, end },
      totals: {
        cases: statusCounts.reduce((acc, curr) => acc + curr.count, 0),
        resolved: resolvedCount,
        mttrHours: Number(mttrHours)
      },
      distribution: {
        status: statusCounts,
        severity: severityCounts,
        type: []
      },
      trends: {
        volume: volumeOverTime
      }
    };
  }

  // ==================== UEBA (User Entity Behavior Analytics) ====================

  async trackLogin(userId: string, ip: string, userAgent: string = '') {
      try {
          // 1. Get Location
          const currentGeo = GeoIPService.lookup(ip);
          
          // 2. Get Last Login
          const [lastLogin] = await db.select()
              .from(loginHistory)
              .where(eq(loginHistory.userId, userId))
              .orderBy(desc(loginHistory.timestamp))
              .limit(1);

          // 3. Analyze Impossible Travel
          if (currentGeo && lastLogin && lastLogin.latitude && lastLogin.longitude) {
              const distance = GeoIPService.calculateDistance(
                  { latitude: lastLogin.latitude, longitude: lastLogin.longitude },
                  { latitude: currentGeo.latitude, longitude: currentGeo.longitude }
              );

              const timeDiffHours = (Date.now() - new Date(lastLogin.timestamp).getTime()) / (1000 * 60 * 60);
              const speed = GeoIPService.calculateSpeed(distance, timeDiffHours);

              // Thresholds: > 500 mph and > 50 miles
              if (speed > 500 && distance > 50) {
                  await this.triggerImpossibleTravelAlert(userId, ip, currentGeo, lastLogin, distance, speed);
              }
          }

          // 4. Save History
          await db.insert(loginHistory).values({
              userId,
              ipAddress: ip,
              userAgent,
              country: currentGeo?.country,
              city: currentGeo?.city,
              latitude: currentGeo?.latitude,
              longitude: currentGeo?.longitude,
          });

      } catch (error) {
          console.error('AnalyticsService.trackLogin Error:', error);
      }
  }

  private async triggerImpossibleTravelAlert(
      userId: string, 
      currentIp: string, 
      currentGeo: any, 
      lastLogin: any, 
      distance: number, 
      speed: number
  ) {
      // Fetch user to get tenantId
      const [user] = await db
          .select()
          .from(users) // Assuming 'users' is imported from schema
          .where(eq(users.id, userId));

      if (!user || !user.tenantId) return;

      const description = `
**Impossible Travel Detected**
User logged in from two locations that are physically impossible to travel between in the elapsed time.

- **Previous Login**: ${lastLogin.city || 'Unknown'}, ${lastLogin.country || 'Unknown'} (${lastLogin.ipAddress}) at ${new Date(lastLogin.timestamp).toLocaleString()}
- **Current Login**: ${currentGeo.city || 'Unknown'}, ${currentGeo.country || 'Unknown'} (${currentIp}) at ${new Date().toLocaleString()}
- **Distance**: ${Math.round(distance)} miles
- **Time Difference**: ${((Date.now() - new Date(lastLogin.timestamp).getTime()) / (1000 * 60)).toFixed(0)} minutes
- **Implied Speed**: ${Math.round(speed)} mph
      `.trim();

      // Use AlertService for robust handling (deduplication, fingerprinting)
      await AlertService.create({
          tenantId: user.tenantId,
          source: 'ueba_analytics',
          severity: 'high',
          title: 'Impossible Travel Detected',
          description,
          rawData: {
              userId,
              speed,
              distance,
              prev: {
                 ip: lastLogin.ipAddress,
                 city: lastLogin.city,
                 country: lastLogin.country, 
                 timestamp: lastLogin.timestamp 
              },
              curr: { 
                 ip: currentIp, 
                 ...currentGeo,
                 timestamp: new Date().toISOString()
              }
          },
          observables: [currentIp, lastLogin.ipAddress, userId]
      });
  }
}

export const analyticsService = new AnalyticsService();
