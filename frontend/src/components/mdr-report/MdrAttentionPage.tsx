import { MdrPageFooter } from './MdrPageFooter'

/**
 * Attention Page - Confidentiality Notice
 */
export function MdrAttentionPage() {
  return (
    <div className="mdr-page mdr-attention-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-6 px-8">
          <h1 className="text-3xl font-bold">Attention</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="max-w-3xl">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8">
              <h2 className="text-xl font-bold text-yellow-800 mb-4">
                ⚠️ Confidential Document
              </h2>
              <p className="text-yellow-700">
                เอกสารฉบับนี้เป็นความลับและรหสัสลับเฉพาะตัว 
                ห้ามเปิดเผยแก่บุคคลที่สามหรือทำสำเนาโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
              </p>
            </div>
            
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-bold text-lg mb-2">Document Classification</h3>
                <p>
                  This document contains sensitive security information about your organization's 
                  IT infrastructure and potential vulnerabilities. Please handle with care and 
                  following your organization's document security policies.
                </p>
              </div>
              
              <div>
                <h3 className="font-bold text-lg mb-2">Intended Audience</h3>
                <p>
                  This report is intended for authorized personnel only, including:
                </p>
                <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                  <li>IT Security Team</li>
                  <li>System Administrators</li>
                  <li>C-Level Executives (IT/Security)</li>
                  <li>Designated Compliance Officers</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-bold text-lg mb-2">Disclaimer</h3>
                <p className="text-sm text-gray-600">
                  The information in this report is based on data collected during the specified 
                  reporting period. Threat landscapes evolve rapidly, and this report represents 
                  a snapshot of your security posture at the time of analysis. Monster Connect 
                  recommends continuous monitoring and regular security assessments.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <MdrPageFooter />
      </div>
    </div>
  )
}
