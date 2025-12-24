import { Elysia, t } from 'elysia'
import { tenantGuard } from '../middlewares/auth.middleware'
import { MdrReportService } from '../core/services/mdr-report.service'
import { MdrPdfService } from '../core/services/mdr-pdf.service'

export const mdrReportController = new Elysia({ prefix: '/mdr-reports' })
  .use(tenantGuard)


  /**
   * List MDR reports for tenant
   * @route GET /mdr-reports
   * @query {string} siteId - Optional site filter ('all' or empty = no filter)
   * @access Protected - Requires authentication
   * @returns {Object} List of MDR reports
   */
  .get('/', async ({ user, query }: any) => {
    // 🔥 1. Extract siteId from Query Param
    // If sent as "all" or empty, treat as undefined (no filter)
    const siteId = query.siteId === 'all' || query.siteId === '' || !query.siteId 
      ? undefined 
      : query.siteId

    // 🔥 2. Pass siteId to Service
    const reports = await MdrReportService.listReports(user.tenantId, siteId)
    
    return { success: true, data: reports }
  })

  /**
   * Get available sites for tenant
   * @route GET /mdr-reports/sites
   * @access Protected - Requires authentication
   */
  .get('/sites', async ({ user, set }: any) => {
    try {
      console.log('✅ [/sites] User Tenant:', user.tenantId)
      
      const sites = await MdrReportService.getSites(user.tenantId)
      return { success: true, data: sites }
    } catch (e) {
      console.error('❌ [/sites] Error:', e)
      set.status = 500
      return { success: false, error: 'Internal Server Error' }
    }
  })

  /**
   * Get single MDR report with latest snapshot
   * @route GET /mdr-reports/:id
   * @access Protected - Requires authentication
   * @returns {Object} Report with snapshot data
   */
  .get('/:id', async ({ user, params, set }: any) => {
    try {
      const { report, snapshot, data } = await MdrReportService.getReportWithSnapshot(params.id)
      
      // Verify tenant access
      if (report.tenantId !== user.tenantId && user.role !== 'superadmin') {
        set.status = 403
        return { success: false, error: 'Access denied' }
      }
      
      return { success: true, data: { report, snapshot, reportData: data } }
    } catch (e: any) {
      console.error(e)
      if (e.message === 'Report not found') {
        set.status = 404
        return { success: false, error: 'Report not found' }
      }
      set.status = 500
      return { success: false, error: 'Internal Server Error' }
    }
  })

  /**
   * Delete draft report
   * @route DELETE /mdr-reports/:id
   * @access Protected - Requires authentication
   */
  .delete('/:id', async ({ user, params, set }: any) => {
    try {
      await MdrReportService.deleteReport(params.id, user.tenantId)
      return { success: true }
    } catch (e) {
      console.error(e)
      set.status = 500
      return { success: false, error: 'Failed to delete report' }
    }
  })

  /**
   * Generate new draft report for a month
   * @route POST /mdr-reports/generate
   * @access Protected - Requires authentication
   * @body {string} monthYear - Month in format 'YYYY-MM'
   * @body {string[]} siteNames - Optional list of sites to filter
   * @returns {Object} Created report with snapshot
   */
  .post('/generate', async ({ user, body, set }: any) => {
    try {
      const { monthYear, siteNames } = body
      
      const result = await MdrReportService.createSnapshot(
        user.tenantId,
        monthYear,
        user.id,
        siteNames || []
      )
      
      return { success: true, data: result }
    } catch (e) {
      console.error('Generate Error:', e)
      set.status = 500
      return { success: false, error: 'Failed to generate report' }
    }
  }, {
    body: t.Object({
      monthYear: t.String({ pattern: '^\\d{4}-\\d{2}$' }), // YYYY-MM format
      siteNames: t.Optional(t.Array(t.String()))
    })
  })

  /**
   * Update report snapshot data
   * @route PUT /mdr-reports/:id/snapshot
   * @access Protected - Requires authentication
   * @body {object} data - Partial report data to update
   * @returns {Object} Updated snapshot
   */
  .put('/:id/snapshot', async ({ user, params, body, set }: any) => {
    // Verify tenant access first
    const { report } = await MdrReportService.getReportWithSnapshot(params.id)
    if (report.tenantId !== user.tenantId && user.role !== 'superadmin') {
      set.status = 403
      return { success: false, error: 'Access denied' }
    }
    
    const snapshot = await MdrReportService.updateSnapshot(
      params.id,
      body.data,
      user.id
    )
    
    return { success: true, data: snapshot }
  }, {
    body: t.Object({
      data: t.Any() // Partial MdrReportData
    })
  })

  /**
   * Approve report and trigger PDF generation
   * @route POST /mdr-reports/:id/approve
   * @access Protected - Requires authentication
   * @returns {Object} Approved report
   */
  .post('/:id/approve', async ({ user, params, set }: any) => {
    // Verify tenant access
    const { report: existingReport } = await MdrReportService.getReportWithSnapshot(params.id)
    if (existingReport.tenantId !== user.tenantId && user.role !== 'superadmin') {
      set.status = 403
      return { success: false, error: 'Access denied' }
    }
    
    const report = await MdrReportService.approveReport(params.id, user.id)
    
    // Trigger PDF generation asynchronously
    // In production, this would be done via a job queue
    MdrPdfService.generatePdf(params.id).catch(err => {
      console.error('PDF generation failed:', err)
    })
    
    return { success: true, data: report }
  })

  /**
   * Download PDF (requires valid download token or auth)
   * @route GET /mdr-reports/:id/pdf
   * @access Protected
   * @returns PDF file binary
   */
  .get('/:id/pdf', async ({ user, params, set }: any) => {
    const { report } = await MdrReportService.getReportWithSnapshot(params.id)
    
    // Verify tenant access
    if (report.tenantId !== user.tenantId && user.role !== 'superadmin') {
      set.status = 403
      return { success: false, error: 'Access denied' }
    }
    
    if (!report.pdfUrl) {
      set.status = 404
      return { success: false, error: 'PDF not generated yet' }
    }
    
    // In production, this would redirect to S3/storage URL or serve the file
    // For now, generate on-demand if needed
    try {
      const pdfBuffer = await MdrPdfService.generatePdf(params.id)
      
      set.headers['Content-Type'] = 'application/pdf'
      set.headers['Content-Disposition'] = `attachment; filename="MDR_Report_${report.monthYear}.pdf"`
      
      return pdfBuffer
    } catch (err) {
      console.error('PDF generation error:', err)
      set.status = 500
      return { success: false, error: 'PDF generation failed' }
    }
  })

  /**
   * Preview PDF (generates without saving)
   * @route GET /mdr-reports/:id/preview
   * @access Protected
   * @returns PDF file binary for preview
   */
  .get('/:id/preview', async ({ user, params, set }: any) => {
    const { report } = await MdrReportService.getReportWithSnapshot(params.id)
    
    // Verify tenant access
    if (report.tenantId !== user.tenantId && user.role !== 'superadmin') {
      set.status = 403
      return { success: false, error: 'Access denied' }
    }
    
    try {
      const pdfBuffer = await MdrPdfService.generatePdf(params.id, { preview: true })
      
      set.headers['Content-Type'] = 'application/pdf'
      set.headers['Content-Disposition'] = 'inline' // Show in browser
      
      return pdfBuffer
    } catch (err) {
      console.error('PDF preview error:', err)
      set.status = 500
      return { success: false, error: 'PDF preview failed' }
    }
  })
