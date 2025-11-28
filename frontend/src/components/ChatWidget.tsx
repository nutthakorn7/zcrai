import { useState, useRef, useEffect } from 'react'
import { Button, Input, Card, CardBody, CardHeader, Divider } from '@heroui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'
import { usePageContext } from '../contexts/PageContext'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am **zcrAI Security Assistant**. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { getContextSummary, pageContext } = usePageContext()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user' as const, content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Add placeholder for AI response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      // @ts-ignore
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Filter out empty messages and prepare for API
      const chatHistory = [...messages, userMessage]
        .filter(m => m.content && m.content.trim() !== '')
        .filter(m => m.role !== 'system') // Remove system messages (errors)
        .map(m => ({ role: m.role, content: m.content }))
      
      // Get rich context from current page
      const pageContextSummary = getContextSummary()
      
      const response = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send cookies for authentication
        body: JSON.stringify({
          messages: chatHistory,
          context: pageContextSummary
        })
      })

      if (!response.ok) throw new Error('Failed to send message')
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        aiContent += chunk
        
        // Update the last message (AI response) with accumulated content
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content = aiContent
          return newMessages
        })
      }

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { role: 'system', content: '⚠️ Error: Failed to connect to AI service.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {/* Chat Window */}
      {isOpen && (
        <Card className="w-[400px] h-[600px] shadow-2xl border border-gray-700 flex flex-col">
          <CardHeader className="flex justify-between items-center p-4 bg-content2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <div>
                <span className="font-bold">zcrAI Assistant</span>
                <p className="text-[10px] text-gray-500">📍 {pageContext.pageName}</p>
              </div>
            </div>
            <Button isIconOnly variant="light" size="sm" onPress={() => setIsOpen(false)}>
              ✕
            </Button>
          </CardHeader>
          <Divider />
          
          {/* Messages Area */}
          <CardBody className="flex-1 overflow-y-auto p-4 space-y-4 bg-content1">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "self-end items-end" : "self-start items-start"
                )}
              >
                <div 
                  className={clsx(
                    "px-4 py-2 rounded-lg text-sm shadow-sm",
                    msg.role === 'user' 
                      ? "bg-primary text-primary-foreground rounded-br-none" 
                      : msg.role === 'system'
                      ? "bg-danger/10 text-danger border border-danger/20 w-full text-center"
                      : "bg-content3 text-foreground rounded-bl-none"
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 opacity-70">
                  {msg.role === 'user' ? 'You' : 'AI'}
                </span>
              </div>
            ))}
            {isLoading && messages[messages.length - 1].role === 'user' && (
              <div className="self-start bg-content3 px-4 py-2 rounded-lg rounded-bl-none">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardBody>

          <Divider />
          
          {/* Input Area */}
          <div className="p-3 bg-content2 flex flex-col gap-2">
            {/* Context Actions */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="flat" 
                color="secondary" 
                className="text-xs h-7"
                startContent={<span className="text-sm">✨</span>}
                onPress={() => {
                  setInput("Please analyze the current page context and identify any security issues or anomalies. Provide recommendations if necessary.")
                  // Optional: Auto send? For now let user confirm.
                  // handleSend() 
                }}
              >
                Analyze Page
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Ask about security alerts..."
                value={input}
                onValueChange={setInput}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                isDisabled={isLoading}
                size="sm"
                classNames={{ inputWrapper: "bg-content1" }}
              />
              <Button 
                isIconOnly 
                color="primary" 
                size="sm" 
                onPress={handleSend}
                isLoading={isLoading}
              >
                ➤
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Floating Button */}
      <Button
        isIconOnly
        radius="full"
        color="primary"
        size="lg"
        className="shadow-lg w-14 h-14"
        onPress={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '🤖'}
      </Button>
    </div>
  )
}
