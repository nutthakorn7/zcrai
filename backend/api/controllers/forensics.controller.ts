/**
 * Forensics Controller
 * API routes for memory forensics and analysis
 */

import { Elysia, t } from 'elysia';
import { withAuth } from '../middleware/auth';
import { ForensicsService } from '../core/services/forensics.service';

export const forensicsController = new Elysia({ prefix: '/forensics' })
  .use(withAuth)
  
  /**
   * Get forensic analysis for a case
   * @route GET /forensics/case/:caseId
   * @access Protected - Requires authentication
   * @param {string} caseId - Case ID
   * @returns {Object} Memory dump analysis results
   * @description Retrieves existing forensic analysis for case
   */
  .get('/case/:caseId', async ({ params }: any) => {
    const analysis = await ForensicsService.analyzeMemoryDump(
      `memdump-${params.caseId}`,
      params.caseId
    );
    return {
      success: true,
      data: analysis,
    };
  })

  /**
   * Capture memory dump from endpoint
   * @route POST /forensics/capture
   * @access Protected - Requires authentication
   * @body {string} hostname - Target hostname/IP
   * @body {string} collectedBy - Collector username
   * @body {string} caseId - Associated case ID (optional)
   * @returns {Object} Capture result with dump ID
   * @description Initiates memory dump collection from target endpoint
   */
  .post('/capture', async ({ body }: any) => {
    const { hostname, collectedBy, caseId } = body;
    
    const result = await ForensicsService.captureMemoryDump(
      hostname,
      collectedBy,
      caseId
    );
    
    return {
      success: true,
      data: result,
    };
  }, {
    body: t.Object({
      hostname: t.String(),
      collectedBy: t.String(),
      caseId: t.Optional(t.String()),
    }),
  })

  /**
   * Analyze existing memory dump
   * @route POST /forensics/analyze
   * @access Protected - Requires authentication
   * @body {string} dumpId - Memory dump ID (optional)
   * @body {string} caseId - Case ID (optional)
   * @returns {Object} Analysis results (processes, network, malware indicators)
   * @description Runs forensic analysis on memory dump
   */
  .post('/analyze', async ({ body }: any) => {
    const { dumpId, caseId } = body;
    
    const analysis = await ForensicsService.analyzeMemoryDump(
      dumpId || `memdump-${Date.now()}`,
      caseId || 'CASE-UNKNOWN'
    );
    
    return {
      success: true,
      data: analysis,
    };
  }, {
    body: t.Object({
      dumpId: t.Optional(t.String()),
      caseId: t.Optional(t.String()),
    }),
  })

  /**
   * Get specific analysis by dump ID
   * @route GET /forensics/dump/:dumpId
   * @access Protected - Requires authentication
   * @param {string} dumpId - Memory dump ID
   * @returns {Object} Forensic analysis results
   */
  .get('/dump/:dumpId', async ({ params }: any) => {
    const analysis = await ForensicsService.analyzeMemoryDump(
      params.dumpId,
      'CASE-UNKNOWN'
    );
    return {
      success: true,
      data: analysis,
    };
  });
