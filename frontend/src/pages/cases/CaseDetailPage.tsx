import { Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Button } from "@heroui/react";
import { InvestigationGraph } from '../../components/InvestigationGraph';
import { useCaseDetail } from './useCaseDetail';
import { CaseHeader } from './components/CaseHeader';
import { CaseTabs } from './components/CaseTabs';
import { CaseSidebar } from './components/CaseSidebar';

export default function CaseDetailPage() {
  const { 
    // Data
    caseItem,
    loading,
    user,
    activeUsers,
    typingUsers,
    
    // UI State
    exporting,
    isGraphOpen,
    onGraphOpen,
    onGraphClose,
    isSyncOpen,
    onSyncOpen,
    onSyncClose,
    syncSystem,
    setSyncSystem,
    syncing,

    // AI State
    aiResult,
    aiSuggestion,
    aiLoading,
    copilotMessages,
    copilotQuery,
    setCopilotQuery,
    copilotLoading,

    // Handlers
    emitTyping,
    handleExportPDF,
    handleSyncTicket,
    handleStatusChange,
    handleGenerateAI,
    handleRunSuggestion,
    handleCopilotChat,
    handleComment,
    handleEditComment,
    handleDeleteComment,
    handleUploadAttachment,
    newComment,
    setNewComment
  } = useCaseDetail(window.location.pathname.split('/').pop());

  if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
  if (!caseItem) return <div className="p-10 text-center">Case not found</div>;

  return (
    <div className="p-6 h-full flex flex-col gap-6 w-full pb-32">
      {/* Header */}
      <CaseHeader 
        caseItem={caseItem}
        activeUsers={activeUsers}
        onGraphOpen={onGraphOpen}
        onSyncOpen={onSyncOpen}
        onExportPDF={handleExportPDF}
        exporting={exporting}
        onStatusChange={handleStatusChange}
      />

      {/* Graph Modal */}
      <Modal 
        isOpen={isGraphOpen} 
        onClose={onGraphClose} 
        size="full"
        classNames={{
            base: "bg-black/90 backdrop-blur-xl",
            header: "border-b border-white/10",
            body: "p-0 overflow-hidden",
        }}
      >
        <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
                Visual Investigation: {caseItem.title}
                <span className="text-xs font-normal text-white/50">Space/Scroll to Zoom • Drag to Pan</span>
            </ModalHeader>
            <ModalBody className="h-full w-full">
                {isGraphOpen && <InvestigationGraph caseId={caseItem.id} className="h-full" />}
            </ModalBody>
        </ModalContent>
      </Modal>

      {/* Sync Ticket Modal */}
      <Modal 
        isOpen={isSyncOpen} 
        onClose={onSyncClose}
      >
        <ModalContent>
          <ModalHeader>Sync to Ticket System</ModalHeader>
          <ModalBody className="gap-4">
             <Select label="System" selectedKeys={[syncSystem]} onChange={(e) => setSyncSystem(e.target.value as 'jira'|'servicenow')}>
                 <SelectItem key="jira">Jira Software</SelectItem>
                 <SelectItem key="servicenow">ServiceNow</SelectItem>
             </Select>
             
             <div className="p-3 bg-default-100/50 rounded-lg text-sm text-default-500">
                 Will create a new ticket in the default configured project for this tenant.
             </div>
          </ModalBody>
          <ModalFooter>
             <Button variant="light" onPress={onSyncClose}>Cancel</Button>
             <Button color="primary" onPress={handleSyncTicket} isLoading={syncing}>
                 Create Ticket
             </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
         {/* Left: Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <CaseTabs 
                caseItem={caseItem}
                currentUserEmail={user?.email || ''}
                newComment={newComment}
                setNewComment={setNewComment}
                typingUsers={typingUsers}
                onEmitTyping={emitTyping}
                onComment={() => handleComment(newComment)}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
                copilotMessages={copilotMessages}
                copilotQuery={copilotQuery}
                setCopilotQuery={setCopilotQuery}
                copilotLoading={copilotLoading}
                onCopilotChat={handleCopilotChat}
            />
          </div>

         {/* Right: Meta & Evidence */}
         <div className="flex flex-col gap-4">
            <CaseSidebar 
                caseItem={caseItem}
                user={user}
                aiResult={aiResult}
                aiSuggestion={aiSuggestion}
                aiLoading={aiLoading}
                onGenerateAI={handleGenerateAI}
                onRunPlaybook={handleRunSuggestion}
                onUploadAttachment={handleUploadAttachment}
            />
         </div>
      </div>
    </div>
  );
}
