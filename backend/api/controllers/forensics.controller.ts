/**
 * Forensics Controller
 * API routes for memory forensics and analysis
 */

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ForensicsService } from '../core/services/forensics.service';

export const forensicsController = new Elysia({ prefix: '/forensics' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'super_secret_dev_key',
      exp: '1h'
    })
  )
  .derive(async ({ jwt, cookie: { access_token } }: any) => {
    if (!access_token?.value || typeof access_token.value !== 'string') return { user: null };
    const payload = await jwt.verify(access_token.value);
    return { user: payload };
  })
  .onBeforeHandle(({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  })
  
  /**
   * Get forensic analysis for a case
   */
  .get('/case/:caseId', async ({ params }: any) => {
    try {
      const analysis = await ForensicsService.analyzeMemoryDump(
        `memdump-${params.caseId}`,
        params.caseId
      );
      return {
        success: true,
        data: analysis,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  })

  /**
   * Capture memory dump
   */
  .post('/capture', async ({ body, set }: any) => {
    try {
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
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  }, {
    body: t.Object({
      hostname: t.String(),
      collectedBy: t.String(),
      caseId: t.Optional(t.String()),
    }),
  })

  /**
   * Analyze memory dump
   */
  .post('/analyze', async ({ body, set }: any) => {
    try {
      const { dumpId, caseId } = body;
      
      const analysis = await ForensicsService.analyzeMemoryDump(
        dumpId || `memdump-${Date.now()}`,
        caseId || 'CASE-UNKNOWN'
      );
      
      return {
        success: true,
        data: analysis,
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message };
    }
  }, {
    body: t.Object({
      dumpId: t.Optional(t.String()),
      caseId: t.Optional(t.String()),
    }),
  })

  /**
   * Get specific analysis by dump ID
   */
  .get('/dump/:dumpId', async ({ params }: any) => {
    try {
      const analysis = await ForensicsService.analyzeMemoryDump(
        params.dumpId,
        'CASE-UNKNOWN'
      );
      return {
        success: true,
        data: analysis,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  });
