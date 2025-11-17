import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './ChatInterface.css'

function ChatInterface({ storeId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Also scroll when loading changes
    if (!loading) {
      setTimeout(scrollToBottom, 100)
    }
  }, [loading])

  const sendMessage = async (messageContent, retryCount = 0) => {
    setLoading(true)
    const maxRetries = 5
    const baseDelay = 2000 // 2 seconds

    try {
      // Build conversation history in Gemini format
      const history = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))

      const response = await axios.post('/api/chat', {
        message: messageContent,
        store_id: storeId,
        history: history
      })

      if (response.data.success) {
        const aiMessage = {
          role: 'assistant',
          content: response.data.response,
          citations: response.data.citations || [],
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, aiMessage])
        setLoading(false)
      }
    } catch (err) {
      const errorStatus = err.response?.status
      const errorMessage = err.response?.data?.error || 'Failed to get response'

      // Check if it's a 503 error or "overloaded" error
      const is503Error = errorStatus === 503 ||
                         errorMessage.toLowerCase().includes('overloaded') ||
                         errorMessage.toLowerCase().includes('unavailable')

      if (is503Error && retryCount < maxRetries) {
        // Retry with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount)
        console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)

        setTimeout(() => {
          sendMessage(messageContent, retryCount + 1)
        }, delay)
      } else {
        // Show error only if it's not a 503 or we've exceeded max retries
        setLoading(false)
        const errorMsg = {
          role: 'error',
          content: is503Error
            ? 'The AI service is currently overloaded. Please try again in a few moments.'
            : errorMessage,
          timestamp: new Date().toISOString(),
          retryMessage: messageContent
        }
        setMessages(prev => [...prev, errorMsg])
      }
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = input
    setInput('')

    await sendMessage(messageToSend)
  }

  const handleRetry = async (messageContent) => {
    const userMessage = {
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    await sendMessage(messageContent)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatMessage = (text) => {
    if (!text) return ''

    // Escape HTML to prevent XSS
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    // Format markdown-style elements
    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>')

    // Italic: *text* or _text_
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>')
    formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>')

    // Code blocks: ```code```
    formatted = formatted.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>')

    // Inline code: `code`
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>')

    // Headers: # Header
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Lists: - item or * item
    formatted = formatted.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

    // Numbered lists: 1. item
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

    // Line breaks: double newline = paragraph
    formatted = formatted.split('\n\n').map(para => {
      if (para.trim() && !para.startsWith('<')) {
        return `<p>${para}</p>`
      }
      return para
    }).join('\n')

    // Single line breaks
    formatted = formatted.replace(/\n/g, '<br>')

    return formatted
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <h3>Start a conversation</h3>
            <p>Ask questions about your uploaded documents</p>
            <div className="sample-questions">
              <p className="sample-label">Try asking:</p>
              <ul>
                <li>"Summarize the main points from the documents"</li>
                <li>"What are the key findings?"</li>
                <li>"Find information about [topic]"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? '👤 You' : msg.role === 'error' ? '⚠️ Error' : '🤖 AI'}
              </span>
              <span className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div
              className="message-content"
              dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
            />
            {msg.role === 'error' && msg.retryMessage && (
              <button
                className="retry-btn"
                onClick={() => handleRetry(msg.retryMessage)}
                disabled={loading}
              >
                🔄 Retry
              </button>
            )}
            {msg.citations && msg.citations.length > 0 && (
              <div className="citations">
                <p className="citations-label">📚 Sources:</p>
                <ul>
                  {msg.citations.map((citation, idx) => (
                    <li key={idx}>
                      {citation.title || citation.uri}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message assistant loading">
            <div className="message-header">
              <span className="message-role">🤖 AI</span>
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about your documents..."
          className="message-input"
          rows="3"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          className="send-btn"
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '📤'} Send
        </button>
      </div>
    </div>
  )
}

export default ChatInterface
