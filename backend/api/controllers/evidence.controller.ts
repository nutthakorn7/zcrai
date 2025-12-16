/**
 * Evidence Controller
 * API routes for evidence chain-of-custody management
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { EvidenceService } from '../core/services/evidence.service';
import { Errors } from '../middleware/error';

export const evidenceController = new Elysia({ prefix: '/evidence' })
  .use(withAuth)
  
  /**
   * Get evidence for a case
   */
  .get('/case/:caseId', async ({ params }: any) => {
    const evidence = await EvidenceService.listCaseEvidence(params.caseId);
    return {
      success: true,
      data: evidence,
    };
  })

  /**
   * Get single evidence item
   */
  .get('/:evidenceId', async ({ params }: any) => {
    const evidence = await EvidenceService.getEvidence(params.evidenceId);
    if (!evidence) throw Errors.NotFound('Evidence');
    return {
      success: true,
      data: evidence,
    };
  })

  /**
   * Register new evidence
   */
  .post('/', async ({ body }: any) => {
    const evidence = await EvidenceService.registerEvidence(body);
    return {
      success: true,
      data: evidence,
    };
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
  .post('/:evidenceId/verify', async ({ params, body }: any) => {
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
  })

  /**
   * Add custody event
   */
  .post('/:evidenceId/custody', async ({ params, body }: any) => {
    await EvidenceService.addCustodyEvent(params.evidenceId, body);
    return {
      success: true,
      message: 'Custody event added',
    };
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
  .get('/:evidenceId/export', async ({ params }: any) => {
    const report = await EvidenceService.exportEvidenceReport(params.evidenceId);
    return {
      success: true,
      ...report,
    };
  });
