import puppeteer, { type Browser, type Page } from 'puppeteer'
import { MdrReportService } from './mdr-report.service'
import { db } from '../../infra/db'
import { mdrReports } from '../../infra/db/schema'
import { eq } from 'drizzle-orm'

// Singleton browser instance for performance
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })
  }
  return browser
}

export const MdrPdfService = {
  /**
   * Generate PDF from MDR report by opening the React print route
   * @param reportId Report ID
   * @param options Generation options
   * @returns PDF buffer
   */
  async generatePdf(reportId: string, options?: { preview?: boolean }): Promise<Buffer> {
    const browserInstance = await getBrowser()
    let page: Page | null = null
    
    try {
      // Get report data to verify it exists
      const { report, data } = await MdrReportService.getReportWithSnapshot(reportId)
      
      if (!data) {
        throw new Error('No report data found')
      }
      
      // Create new page
      page = await browserInstance.newPage()
      
      // Set viewport for A4 landscape
      await page.setViewport({
        width: 1920,
        height: 1080
      })
      
      // Navigate to the print route
      // In production, use environment variable for base URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const printUrl = `${baseUrl}/report-print/${reportId}`
      
      console.log(`[MdrPdfService] Navigating to: ${printUrl}`)
      
      // Navigate and wait for content to load
      await page.goto(printUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000 // 60 seconds timeout
      })
      
      // Wait for the report to fully render
      // Look for a specific element that indicates the report is ready
      try {
        await page.waitForSelector('[data-report-ready="true"]', {
          timeout: 30000
        })
      } catch {
        // If no ready indicator, wait a bit for content
        console.log('[MdrPdfService] Ready indicator not found, waiting for content')
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
      
      // Additional wait for any animations/charts to complete
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        },
        scale: 1
      })
      
      console.log(`[MdrPdfService] PDF generated, size: ${pdfBuffer.length} bytes`)
      
      // Update report with PDF URL if not preview mode
      if (!options?.preview) {
        // In production, upload to S3/storage and save URL
        // For now, we'll just mark as generated
        const pdfPath = `/reports/${reportId}/mdr_report_${report.monthYear}.pdf`
        await db.update(mdrReports)
          .set({ 
            pdfUrl: pdfPath,
            status: 'approved',
            updatedAt: new Date()
          })
          .where(eq(mdrReports.id, reportId))
      }
      
      return Buffer.from(pdfBuffer)
      
    } catch (error) {
      console.error('[MdrPdfService] PDF generation failed:', error)
      
      // Update report status to error
      await db.update(mdrReports)
        .set({ 
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(mdrReports.id, reportId))
      
      throw error
    } finally {
      // Close the page to free resources
      if (page) {
        await page.close()
      }
    }
  },
  
  /**
   * Cleanup browser instance
   */
  async cleanup(): Promise<void> {
    if (browser) {
      await browser.close()
      browser = null
    }
  },
  
  /**
   * Generate PDF from raw HTML (fallback method)
   * This can be used if the React route is not available
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    const browserInstance = await getBrowser()
    const page = await browserInstance.newPage()
    
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' })
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      })
      
      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  await MdrPdfService.cleanup()
})
