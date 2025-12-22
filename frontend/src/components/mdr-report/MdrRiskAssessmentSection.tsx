interface MdrRiskAssessmentSectionProps {
  result: string
  recommendation: string
}

/**
 * Risk Assessment Section
 * Shows risk analysis result and strategic recommendations
 */
export function MdrRiskAssessmentSection({ result, recommendation }: MdrRiskAssessmentSectionProps) {
  return (
    <div className="mdr-page mdr-risk-assessment-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-4 px-8">
          <h1 className="text-2xl font-bold">3. Risk Assessment</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-8">
          {/* Risk Level Indicator */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              3.1 Assessment Result
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-2">Risk Analysis</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {result || 'No risk assessment available for this period.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Strategic Recommendation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              3.2 Strategic Recommendation
            </h3>
            
            <div className="bg-lime-50 rounded-lg p-6 border-l-4 border-lime-500">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-lime-100 flex items-center justify-center">
                    <span className="text-2xl">💡</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {recommendation || 'No strategic recommendations available.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Priority Action Items */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Priority Actions
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="font-semibold text-red-800">Critical</span>
                </div>
                <p className="text-sm text-red-700">
                  Immediate action required for unmitigated threats
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-amber-500 rounded-full" />
                  <span className="font-semibold text-amber-800">High</span>
                </div>
                <p className="text-sm text-amber-700">
                  Review suspicious activities within 24 hours
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="font-semibold text-blue-800">Medium</span>
                </div>
                <p className="text-sm text-blue-700">
                  Schedule patching and software updates
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 text-center text-sm text-gray-400 border-t">
          Page 8
        </div>
      </div>
    </div>
  )
}
