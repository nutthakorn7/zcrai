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
   * Get all evidence for a case
   * @route GET /evidence/case/:caseId
   * @access Protected - Requires authentication
   * @param {string} caseId - Case ID
   * @returns {Object} List of evidence items with custody chain
   */
  .get('/case/:caseId', async ({ params }: any) => {
    const evidence = await EvidenceService.listCaseEvidence(params.caseId);
    return {
      success: true,
      data: evidence,
    };
  })

  /**
   * Get single evidence item with full details
   * @route GET /evidence/:evidenceId
   * @access Protected - Requires authentication
   * @param {string} evidenceId - Evidence ID
   * @returns {Object} Evidence details with custody history
   * @throws {404} Evidence not found
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
   * Register new evidence item
   * @route POST /evidence
   * @access Protected - Requires authentication
   * @body {string} caseId - Associated case ID
   * @body {string} type - Evidence type (file, memory_dump, network_capture, etc.)
   * @body {string} name - Evidence name/description
   * @body {string} collectedBy - Collector username
   * @body {object} hash - File hashes (md5, sha256)
   * @body {object} metadata - Additional metadata (optional)
   * @returns {Object} Created evidence record
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
   * Verify evidence integrity via hash comparison
   * @route POST /evidence/:evidenceId/verify
   * @access Protected - Requires authentication
   * @param {string} evidenceId - Evidence ID
   * @body {string} md5 - MD5 hash to verify (optional)
   * @body {string} sha256 - SHA256 hash to verify (optional)
   * @returns {Object} Verification result (passed/failed)
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
   * Add custody event to chain of custody
   * @route POST /evidence/:evidenceId/custody
   * @access Protected - Requires authentication
   * @param {string} evidenceId - Evidence ID
   * @body {string} action - Custody action (collected, transferred, analyzed, stored)
   * @body {string} performedBy - Person performing action
   * @body {string} location - Physical/digital location
   * @body {string} notes - Additional notes (optional)
   * @returns {Object} Success message
   * @description Maintains tamper-proof chain of custody for legal evidence
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
   * Export evidence report for court/compliance
   * @route GET /evidence/:evidenceId/export
   * @access Protected - Requires authentication
   * @param {string} evidenceId - Evidence ID
   * @returns {Object} Formatted evidence report with full custody chain
   * @description Generates comprehensive evidence report suitable for legal proceedings
   */
  .get('/:evidenceId/export', async ({ params }: any) => {
    const report = await EvidenceService.exportEvidenceReport(params.evidenceId);
    return {
      success: true,
      ...report,
    };
  });
