import lineQR from '../../assets/report/mc-line-qr.png'

/**
 * Contact Page - Final page with company contact information
 */
export function MdrContactPage() {
  return (
    <div className="mdr-page mdr-contact-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-4 px-8">
          <h1 className="text-2xl font-bold">Contact Us</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-12 items-start">
              {/* Left Column: Contact Information */}
              <div className="space-y-6">
                {/* Company Logo */}
                <div className="w-32 h-32 bg-lime-100 rounded-full flex items-center justify-center mb-6 p-4">
                  <img src="/src/assets/report/mc-logo.webp" alt="Monster Connect Logo" className="w-full h-full object-contain" />
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    Monster Connect Co., Ltd.
                  </h2>
                  <p className="text-lg text-lime-600">
                    Your Trusted Cybersecurity Partner
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                      <span className="mr-2">📍</span> Address
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Monster Connect Co.,Ltd.<br />
                      NASA STREET Building B, 99/1 Room L3-B02-B03,<br />
                      Floor 3rd, Ramkhamhaeng Road,<br />
                      Suan Luang Subdistrict, Suan Luang District,<br />
                      Bangkok 10250
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                      <span className="mr-2">📞</span> Contact
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Tel: 02-026-6664, 02-026-6665<br />
                      Email: sales@mon.co.th<br />
                      Line OA: @monsterconnect
                    </p>
                  </div>

                  <div className="bg-lime-50 rounded-lg p-4 border border-lime-200">
                    <h3 className="font-semibold text-lime-800 mb-2 flex items-center">
                      <span className="mr-2">🌐</span> Online
                    </h3>
                    <p className="text-lime-700 text-sm">
                      Website: www.monsterconnect.co.th
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: QR Code */}
              <div className="flex flex-col items-center justify-center h-full">
                <div className="bg-white p-6 rounded-lg border-2 border-lime-500 shadow-lg">
                  <img 
                    src={lineQR} 
                    alt="Line OA QR Code" 
                    className="w-64 h-64 object-contain"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Scan to add Line Official Account<br />
                  <span className="font-semibold text-lime-600">@monsterconnect</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-800 text-white">
          <div className="flex justify-between items-center">
            <p className="text-sm">
              © {new Date().getFullYear()} Monster Connect Co., Ltd. All rights reserved.
            </p>
            <p className="text-sm">
              This report is confidential and intended for authorized recipients only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
