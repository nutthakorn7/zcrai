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
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center max-w-2xl">
            {/* Company Logo Placeholder */}
            <div className="w-32 h-32 mx-auto mb-8 bg-lime-100 rounded-full flex items-center justify-center">
              <span className="text-5xl">🛡️</span>
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Monster Connect Co., Ltd.
            </h2>
            <p className="text-lg text-lime-600 mb-8">
              Your Trusted Cybersecurity Partner
            </p>
            
            <div className="grid grid-cols-2 gap-8 text-left mb-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📍 Address</h3>
                <p className="text-gray-600 text-sm">
                  123 Cyber Security Tower<br />
                  Silom Road, Bangrak<br />
                  Bangkok 10500, Thailand
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-3">📞 Contact</h3>
                <p className="text-gray-600 text-sm">
                  Tel: +66 2 XXX XXXX<br />
                  Email: soc@monsterconnect.co.th<br />
                  24/7 SOC Hotline: +66 2 XXX XXXX
                </p>
              </div>
            </div>
            
            <div className="bg-lime-50 rounded-lg p-6 border border-lime-200">
              <h3 className="font-semibold text-lime-800 mb-3">🌐 Online</h3>
              <p className="text-lime-700">
                Website: www.monsterconnect.co.th<br />
                Customer Portal: portal.monsterconnect.co.th
              </p>
            </div>
            
            {/* QR Code Placeholder */}
            <div className="mt-8">
              <div className="inline-block bg-white p-4 rounded-lg border-2 border-lime-500">
                <div className="w-32 h-32 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xs text-center">
                    QR Code<br />Placeholder
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Scan to visit our website
              </p>
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
