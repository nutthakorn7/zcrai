import { chromium, type Browser, type Page } from 'playwright'
import { MdrReportService } from './mdr-report.service'
import { db } from '../../infra/db'
import { mdrReports } from '../../infra/db/schema'
import { eq } from 'drizzle-orm'

// Singleton browser instance for performance
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      timeout: 60000, // เพิ่ม timeout (ปกติ 30s)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu', // สำคัญสำหรับ Windows บางเครื่อง
        '--disable-software-rasterizer', // เพิ่มตัวนี้
        '--run-all-compositor-stages-before-draw' // ช่วยเรื่อง render PDF
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
      
      // Create browser context with viewport (Playwright way)
      const context = await browserInstance.newContext({
        viewport: {
          width: 1920,
          height: 1080
        }
      })
      
      // Create new page from context
      page = await context.newPage()
      
      // Navigate to the print route
      // In production, use environment variable for base URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const printUrl = `${baseUrl}/report-print/${reportId}`
      
      console.log(`[MdrPdfService] Navigating to: ${printUrl}`)
      
      // Navigate and wait for content to load
      await page.goto(printUrl, {
        waitUntil: 'networkidle',
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
        displayHeaderFooter: true,
        footerTemplate: `
          <div style="width: 100%; font-size: 8px; text-align: center; color: #9CA3AF; padding: 8px 0; border-top: 1px solid #F3F4F6; margin: 0 64px;">
            <span>Monster Connect | Managed Security Services</span>
            <span style="margin-left: 20px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '20mm',
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
      // Close the page and context to free resources
      if (page) {
        await page.close()
        await page.context().close()
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
    
    // Create browser context with viewport
    const context = await browserInstance.newContext({
      viewport: {
        width: 1920,
        height: 1080
      }
    })
    const page = await context.newPage()
    
    try {
      await page.setContent(html, { waitUntil: 'networkidle' })
      
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
      await context.close()
    }
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  await MdrPdfService.cleanup()
})
