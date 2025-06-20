import { Send } from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { useContext, useRef } from 'react'
import { ChatContext } from './ChatContext'

interface ChatInputProps {
    isDisabled?: boolean
}

const ChatInput = ({ isDisabled }: ChatInputProps) => {
    const {
        addMessage,
        handleInputChange,
        isLoading,
        message,
    } = useContext(ChatContext)

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSend = () => {
        if (message.trim()) {
            addMessage()
            textareaRef.current?.focus() // Keep focus on textarea after send
        }
    }

    return (
        <div className='w-full p-2'> {/* Added some padding to the outer div */}
            <div className='mx-auto flex flex-row gap-3 md:mx-4 lg:mx-auto lg:max-w-2xl xl:max-w-3xl items-end'> {/* items-end to align button with textarea bottom */}
                <div className='relative flex h-full flex-1 items-stretch md:flex-col'>
                    <div className='relative flex flex-col w-full flex-grow p-1'> {/* Reduced padding slightly */}
                        <Textarea
                            rows={1}
                            ref={textareaRef}
                            maxRows={4}
                            autoFocus
                            onChange={handleInputChange}
                            value={message}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSend() // Use handleSend
                                }
                            }}
                            placeholder='Ask a question about the documents...'
                            className='resize-none pr-12 text-base py-3 scrollbar-thumb-blue scrollbar-thumb-rounded scrollbar-track-blue-lighter scrollbar-w-2 scrolling-touch'
                            disabled={isDisabled || isLoading}
                        />
                    </div>
                </div>
                <Button
                    disabled={isLoading || isDisabled || !message.trim()}
                    className="px-3 py-2 self-end mb-1" // Align button nicely, add bottom margin to match textarea padding
                    onClick={handleSend} // Use handleSend
                    aria-label="send message"
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}

export default ChatInput