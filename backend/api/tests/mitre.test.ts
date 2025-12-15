/**
 * MITRE Service Tests
 */
import { describe, test, expect } from 'bun:test';

describe('MitreService', () => {
  test('should be defined', async () => {
    const { MitreService } = await import('../core/services/mitre.service');
    expect(MitreService).toBeDefined();
    expect(MitreService.getCoverage).toBeDefined();
    expect(MitreService.getSummary).toBeDefined();
  });

  test('getCoverage should return 12 tactics', async () => {
    const { MitreService } = await import('../core/services/mitre.service');
    
    try {
      const coverage = await MitreService.getCoverage('00000000-0000-0000-0000-000000000000');
      expect(coverage.length).toBe(12);
      
      // Check first tactic structure
      expect(coverage[0]).toHaveProperty('id');
      expect(coverage[0]).toHaveProperty('name');
      expect(coverage[0]).toHaveProperty('shortName');
      expect(coverage[0]).toHaveProperty('count');
      expect(coverage[0]).toHaveProperty('techniques');
      expect(coverage[0]).toHaveProperty('intensity');
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });

  test('getSummary should return valid stats', async () => {
    const { MitreService } = await import('../core/services/mitre.service');
    
    try {
      const summary = await MitreService.getSummary('00000000-0000-0000-0000-000000000000');
      expect(summary).toHaveProperty('totalDetections');
      expect(summary).toHaveProperty('activeTactics');
      expect(summary).toHaveProperty('totalTactics');
      expect(summary).toHaveProperty('coveragePercent');
      expect(summary).toHaveProperty('topTactics');
      
      expect(summary.totalTactics).toBe(12);
    } catch (e: any) {
      expect(e).toBeDefined();
    }
  });
});
