import { useEffect, useState } from 'react'
import {
  Card, CardBody, CardHeader, Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Input, Textarea, Spinner,
  Select, SelectItem, Selection
} from "@heroui/react"
import { Icon } from '../../shared/ui/icon'
import { api } from '../../shared/api/api'
import { MonthPicker } from '../../components/MonthPicker'

interface MdrReport {
  id: string
  tenantId: string
  monthYear: string
  status: 'draft' | 'approved' | 'generating' | 'sent' | 'error'
  siteNames: string[] | null
  pdfUrl: string | null
  approvedBy: string | null
  approvedAt: string | null
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

interface MdrReportData {
  tenantName: string
  monthYear: string
  dateRange: { start: string; end: string }
  generatedAt: string
  overview: {
    threats: number
    mitigated: number
    malicious: number
    suspicious: number
    benign: number
    notMitigated: number
  }
  topEndpoints: Array<{ name: string; count: number }>
  topThreats: Array<{ name: string; count: number }>
  incidentRecommendation: string
  riskAssessment: {
    result: string
    recommendation: string
  }
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  draft: 'warning',
  approved: 'success',
  generating: 'primary',
  sent: 'success',
  error: 'danger'
}

export function MdrReportsTab() {
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<MdrReport[]>([])
  const [generating, setGenerating] = useState(false)
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  // Site Selection (for generating reports)
  const [selectedSites, setSelectedSites] = useState<Selection>(new Set([]))
  const [sites, setSites] = useState<{key: string, label: string}[]>([])
  
  // Site Filter (for filtering report list)
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all')
  
  // Edit Modal State
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const [editingReport, setEditingReport] = useState<MdrReport | null>(null)
  const [editData, setEditData] = useState<MdrReportData | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSites = async () => {
      try {
          const res = await api.get('/mdr-reports/sites')
          if (res.data?.success) {
              setSites(res.data.data.map((s: string) => ({ key: s, label: s })))
          }
      } catch (err) {
          console.error("Failed to fetch sites", err)
      }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      
      // 🔥 Create Query String with site filter
      const siteQuery = selectedSiteFilter && selectedSiteFilter !== 'all' ? selectedSiteFilter : 'all'
      const queryString = siteQuery !== 'all' ? `?siteId=${encodeURIComponent(siteQuery)}` : ''
      
      const response = await api.get(`/mdr-reports${queryString}`)

      console.log('API Response:', response) // 🔍 Debug ดูไส้ใน

      // 🔥 แก้ตรงนี้: เช็ค Structure ให้ชัวร์ก่อน Set
      if (response && Array.isArray(response.data)) {
        // กรณี Backend ส่ง { success: true, data: [...] }
        setReports(response.data)
      } else if (response.data?.success && Array.isArray(response.data.data)) {
        // กรณี Backend ส่ง { success: true, data: [...] }
        setReports(response.data.data)
      } else if (Array.isArray(response)) {
        // กรณี Backend ส่ง [...] มาตรงๆ (เผื่อไว้)
        setReports(response)
      } else {
        // กรณีไม่มีข้อมูล หรือ Format ผิด
        console.warn('Invalid Data Format:', response)
        setReports([])
      }
    } catch (err) {
      console.error('Failed to load reports:', err)
      // toast.error('Failed to load reports') // Uncomment ถ้ามี Toast
      setReports([]) // กันเหนียว set เป็น empty array ไว้
    } finally {
      setLoading(false)
    }
  }

  // 🔥 Reload reports when site filter changes
  useEffect(() => {
    fetchReports()
  }, [selectedSiteFilter]) // Add selectedSiteFilter to dependency array

  useEffect(() => {
    fetchSites()
  }, [])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      // Convert Set to Array
      const siteNames = Array.from(selectedSites).map(String)
      
      const res = await api.post('/mdr-reports/generate', { 
         monthYear,
         siteNames: siteNames.length > 0 ? siteNames : undefined
      })
      setReports([res.data.data, ...reports])
      alert('Report generated successfully!')
    } catch (err: any) {
      console.error('Failed to generate report', err)
      if (err.response?.data?.error === 'Failed to generate report' && err.message?.includes('AI_NOT_CONNECTED')) {
          alert('Connect AI before use this function')
      } else if (err.response?.data?.error?.includes('AI_NOT_CONNECTED')) {
          alert('Connect AI before use this function')
      } else {
           alert(err.response?.data?.error === 'AI_NOT_CONNECTED' ? 'Connect AI before use this function' : 'Failed to generate report')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this draft? This cannot be undone.')) return
    try {
        await api.delete(`/mdr-reports/${reportId}`)
        fetchReports()
    } catch (err) {
        console.error('Failed to delete report', err)
        alert('Failed to delete report')
    }
  }

  const handleEdit = async (report: MdrReport) => {
    try {
      const res = await api.get(`/mdr-reports/${report.id}`)
      if (res.data?.success) {
        setEditingReport(report)
        setEditData(res.data.data.reportData)
        onEditOpen()
      }
    } catch (err) {
      console.error('Failed to fetch report data', err)
      alert('Failed to load report data')
    }
  }

  const handleSave = async () => {
    if (!editingReport || !editData) return
    try {
      setSaving(true)
      await api.put(`/mdr-reports/${editingReport.id}/snapshot`, { data: editData })
      onEditClose()
      fetchReports()
    } catch (err: any) {
      console.error('Failed to save report', err)
      if (err.response?.data?.error === 'Failed to generate report' && err.message?.includes('AI_NOT_CONNECTED')) {
          // This might be tricky depending on how Elysia returns errors.
          // Usually response.data.error contains the message.
          alert('Connect AI before use this function')
      } else if (err.response?.data?.error?.includes('AI_NOT_CONNECTED')) {
          alert('Connect AI before use this function')
      } else {
          // Check for message text directly if wrapper isn't standard
           alert(err.response?.data?.error === 'AI_NOT_CONNECTED' ? 'Connect AI before use this function' : 'Failed to save report')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (reportId: string) => {
    if (!confirm('Approve this report and generate PDF?')) return
    try {
      await api.post(`/mdr-reports/${reportId}/approve`)
      fetchReports()
    } catch (err) {
      console.error('Failed to approve report', err)
      alert('Failed to approve report')
    }
  }

  const handlePreview = (reportId: string) => {
    window.open(`/report-print/${reportId}`, '_blank')
  }

  const handleDownload = async (reportId: string, monthYear: string) => {
    try {
      const res = await api.get(`/mdr-reports/${reportId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MDR_Report_${monthYear}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download PDF', err)
      alert('Failed to download PDF')
    }
  }

  const formatMonthYear = (my: string) => {
    if (!my) return 'Unknown Date'
    const parts = my.split('-')
    if (parts.length < 2) return my
    const [year, month] = parts
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const mIndex = parseInt(month) - 1
    return `${monthNames[mIndex] || month} ${year}`
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Generate New Report */}
      <Card className="bg-content1/50 border border-white/5">
        <CardHeader className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Generate MDR Report</h3>
            <p className="text-sm text-default-500">Create a new monthly security report</p>
          </div>
          <div className="flex gap-3 items-center">
            <Select
                label="Select Sites"
                selectionMode="multiple"
                placeholder="All Sites"
                selectedKeys={selectedSites}
                onSelectionChange={setSelectedSites}
                className="min-w-[200px]"
                size="sm"
                items={sites}
            >
                {(site) => (
                    <SelectItem key={site.key}>{site.label}</SelectItem>
                )}
            </Select>

            <MonthPicker
              value={monthYear}
              onChange={setMonthYear}
            />
            <Button
              color="primary"
              onPress={handleGenerate}
              isLoading={generating}
              startContent={!generating && <Icon.Add className="w-4 h-4" />}
            >
              Generate Draft
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Reports List */}
      <Card className="bg-content1/50 border border-white/5">
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Monthly Reports</h3>
          <Select
            label="Filter by Site"
            placeholder="All Sites"
            selectedKeys={[selectedSiteFilter]}
            onChange={(e) => setSelectedSiteFilter(e.target.value)}
            className="max-w-[200px]"
            size="sm"
          >
            {[
              <SelectItem key="all">All Sites</SelectItem>,
              ...sites.map((site) => (
                <SelectItem key={site.key}>{site.label}</SelectItem>
              ))
            ]}
          </Select>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <Table aria-label="MDR Reports Table">
              <TableHeader>
                <TableColumn>MONTH</TableColumn>
                <TableColumn>SITE</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CREATED</TableColumn>
                <TableColumn>APPROVED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody 
                items={reports || []} 
                emptyContent="No reports found. Generate your first report above."
                isLoading={loading}
                loadingContent={<Spinner label="Loading..." />}
              >
                {(report) => (
                  <TableRow key={report.id || Math.random()}>
                    <TableCell>
                      <span className="font-medium">{formatMonthYear(report.monthYear)}</span>
                    </TableCell>
                    
                    {/* Site Column */}
                    <TableCell>
                      {report.siteNames && report.siteNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {report.siteNames.map((site, idx) => (
                            <Chip 
                              key={idx}
                              size="sm" 
                              variant="flat"
                              color="primary"
                            >
                              {site}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <span className="text-default-400 text-sm">All Sites</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        size="sm"
                        color={STATUS_COLORS[report.status] || 'default'}
                        variant="flat"
                      >
                        {report.status ? report.status.toUpperCase() : 'UNKNOWN'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {report.approvedAt 
                        ? new Date(report.approvedAt).toLocaleDateString()
                        : <span className="text-default-400">—</span>
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {/* Preview */}
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => handlePreview(report.id)}
                          startContent={<Icon.Eye className="w-4 h-4" />}
                        >
                          Preview
                        </Button>

                        {/* Edit (only for drafts) */}
                        <Button
                            size="sm"
                            variant="flat"
                            color="warning"
                            onPress={() => handleEdit(report)}
                            isDisabled={report.status === 'approved'}
                            startContent={<Icon.Edit className="w-4 h-4" />}
                        >
                            Edit
                        </Button>

                        {/* Approve (only for drafts) */}
                        <Button
                            size="sm"
                            color="success"
                            variant="flat"
                            onPress={() => handleApprove(report.id)}
                            isDisabled={report.status === 'approved'}
                            startContent={<Icon.CheckCircle className="w-4 h-4" />}
                        >
                            Approve
                        </Button>

                        {/* Delete (always enabled for drafts, maybe check status) */}
                        <Button 
                            isIconOnly 
                            size="sm" 
                            variant="flat" 
                            color="danger" 
                            onPress={() => handleDelete(report.id)}
                        >
                            <Icon.Delete className="w-4 h-4" />
                        </Button>

                        {/* Download (only for approved/sent) */}
                        {(report.status === 'approved' || report.status === 'sent') && report.pdfUrl && (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => handleDownload(report.id, report.monthYear)}
                            startContent={<Icon.Download className="w-4 h-4" />}
                          >
                            Download
                          </Button>
                        )}

                        {/* Error message */}
                        {report.status === 'error' && report.errorMessage && (
                          <span className="text-danger text-xs">{report.errorMessage}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onOpenChange={onEditClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                Edit Report: {editingReport && formatMonthYear(editingReport.monthYear)}
              </ModalHeader>
              <ModalBody>
                {editData && (
                  <div className="space-y-6">
                    {/* Overview Stats */}
                    <Card className="bg-content2">
                      <CardHeader>
                        <h4 className="font-semibold">Overview Statistics</h4>
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            type="number"
                            label="Threats"
                            value={String(editData.overview.threats)}
                            onChange={(e) => setEditData({
                              ...editData,
                              overview: { ...editData.overview, threats: parseInt(e.target.value) || 0 }
                            })}
                          />
                          <Input
                            type="number"
                            label="Mitigated"
                            value={String(editData.overview.mitigated)}
                            onChange={(e) => setEditData({
                              ...editData,
                              overview: { ...editData.overview, mitigated: parseInt(e.target.value) || 0 }
                            })}
                          />
                          <Input
                            type="number"
                            label="Not Mitigated"
                            value={String(editData.overview.notMitigated)}
                            onChange={(e) => setEditData({
                              ...editData,
                              overview: { ...editData.overview, notMitigated: parseInt(e.target.value) || 0 }
                            })}
                          />
                        </div>
                      </CardBody>
                    </Card>

                    {/* AI Generated Sections */}
                    <Card className="bg-content2">
                      <CardHeader>
                        <h4 className="font-semibold">Incident Recommendation (AI Generated)</h4>
                      </CardHeader>
                      <CardBody>
                        <Textarea
                          value={editData.incidentRecommendation}
                          onChange={(e) => setEditData({
                            ...editData,
                            incidentRecommendation: e.target.value
                          })}
                          minRows={4}
                          placeholder="Recommendation text..."
                        />
                      </CardBody>
                    </Card>

                    <Card className="bg-content2">
                      <CardHeader>
                        <h4 className="font-semibold">Risk Assessment</h4>
                      </CardHeader>
                      <CardBody className="space-y-4">
                        <Textarea
                          label="Assessment Result"
                          value={editData.riskAssessment.result}
                          onChange={(e) => setEditData({
                            ...editData,
                            riskAssessment: { ...editData.riskAssessment, result: e.target.value }
                          })}
                          minRows={3}
                        />
                        <Textarea
                          label="Recommendation"
                          value={editData.riskAssessment.recommendation}
                          onChange={(e) => setEditData({
                            ...editData,
                            riskAssessment: { ...editData.riskAssessment, recommendation: e.target.value }
                          })}
                          minRows={4}
                        />
                      </CardBody>
                    </Card>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSave} isLoading={saving}>
                  Save Changes
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
