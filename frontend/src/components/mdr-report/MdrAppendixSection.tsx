import { MdrPageFooter } from './MdrPageFooter'

interface GlossaryItem {
  term: string
  definition: string
}

interface MdrAppendixSectionProps {
  glossary: GlossaryItem[]
}

/**
 * Appendix Section with Glossary
 */
export function MdrAppendixSection({ glossary }: MdrAppendixSectionProps) {
  // Default glossary if none provided
  const defaultGlossary: GlossaryItem[] = [
    { term: 'APT (Advanced Persistent Threat)', definition: 'A prolonged and targeted cyberattack in which an intruder gains access to a network and remains undetected for an extended period.' },
    { term: 'CVE (Common Vulnerabilities and Exposures)', definition: 'A standardized identifier for known security vulnerabilities and exposures.' },
    { term: 'EDR (Endpoint Detection and Response)', definition: 'Security technology that continuously monitors endpoints to detect and respond to cyber threats.' },
    { term: 'IOC (Indicator of Compromise)', definition: 'Forensic data that suggests a system may have been breached or compromised.' },
    { term: 'Lateral Movement', definition: 'Techniques that attackers use to progressively move through a network searching for key data and assets.' },
    { term: 'Malware', definition: 'Software designed to disrupt, damage, or gain unauthorized access to computer systems.' },
    { term: 'MDR (Managed Detection and Response)', definition: 'A cybersecurity service that combines technology and human expertise to perform threat hunting, monitoring, and response.' },
    { term: 'MITRE ATT&CK', definition: 'A globally accessible knowledge base of adversary tactics and techniques based on real-world observations.' },
    { term: 'Ransomware', definition: 'A type of malware that encrypts files and demands payment for the decryption key.' },
    { term: 'TTP (Tactics, Techniques, and Procedures)', definition: 'The behavior patterns used by threat actors in cyberattacks.' },
  ]
  
  const items = glossary?.length > 0 ? glossary : defaultGlossary
  
  return (
    <div className="mdr-page mdr-appendix-page">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-lime-500 text-white py-4 px-8">
          <h1 className="text-2xl font-bold">7. Appendix</h1>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-6 flex flex-col overflow-hidden">
          <h3 className="text-md font-semibold text-gray-800 mb-4 h-shrink-0">
            7.1 Glossary of Terms
          </h3>
          
          <div className="grid grid-cols-2 gap-3 overflow-hidden">
            {items.map((item, index) => (
              <div 
                key={index}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <h4 className="font-semibold text-lime-700 mb-1 text-sm">{item.term}</h4>
                <p className="text-xs text-gray-600 leading-tight">{item.definition}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <MdrPageFooter />
      </div>
    </div>
  )
}
