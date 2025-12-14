/**
 * Evidence Controller
 * API routes for evidence chain-of-custody management
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { EvidenceService } from '../core/services/evidence.service';

export const evidenceController = new Elysia({ prefix: '/evidence' })
  .use(withAuth)
  
  /**
   * Get evidence for a case
   */
  .get('/case/:caseId', async ({ params }: any) => {
    try {
      const evidence = await EvidenceService.listCaseEvidence(params.caseId);
      return {
        success: true,
        data: evidence,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  })

  /**
   * Get single evidence item
   */
  .get('/:evidenceId', async ({ params, set }: any) => {
    try {
      const evidence = await EvidenceService.getEvidence(params.evidenceId);
      if (!evidence) {
        set.status = 404;
        return { success: false, error: 'Evidence not found' };
      }
      return {
        success: true,
        data: evidence,
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  })

  /**
   * Register new evidence
   */
  .post('/', async ({ body, set }: any) => {
    try {
      const evidence = await EvidenceService.registerEvidence(body);
      return {
        success: true,
        data: evidence,
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  }, {
    body: t.Object({
      caseId: t.String(),
      type: t.String(),
      name: t.String(),
      collectedBy: t.String(),
      hash: t.Object({
        md5: t.String(),
        sha256: t.String(),
      }),
      metadata: t.Optional(t.Any()),
    }),
  })

  /**
   * Verify evidence integrity
   */
  .post('/:evidenceId/verify', async ({ params, body, set }: any) => {
    try {
      const { md5, sha256 } = body || {};
      
      if (!md5 && !sha256) {
        const evidence = await EvidenceService.getEvidence(params.evidenceId);
        if (evidence) {
          const result = await EvidenceService.verifyIntegrity(
            params.evidenceId, 
            evidence.hash
          );
          return { success: true, data: result };
        }
      }
      
      const result = await EvidenceService.verifyIntegrity(
        params.evidenceId,
        { md5: md5 || '', sha256: sha256 || '' }
      );
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  })

  /**
   * Add custody event
   */
  .post('/:evidenceId/custody', async ({ params, body, set }: any) => {
    try {
      await EvidenceService.addCustodyEvent(params.evidenceId, body);
      return {
        success: true,
        message: 'Custody event added',
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  }, {
    body: t.Object({
      action: t.String(),
      performedBy: t.String(),
      location: t.String(),
      notes: t.Optional(t.String()),
    }),
  })

  /**
   * Export evidence report
   */
  .get('/:evidenceId/export', async ({ params, set }: any) => {
    try {
      const report = await EvidenceService.exportEvidenceReport(params.evidenceId);
      return {
        success: true,
        ...report,
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  });
