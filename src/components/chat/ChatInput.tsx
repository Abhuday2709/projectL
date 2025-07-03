import React, { useContext, useRef, useEffect } from 'react'
import { ChatContext } from './ChatContext'
import { Send,Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
    isDisabled: boolean
}

function ChatInput({ isDisabled }: ChatInputProps) {
    const {
        message,
        handleInputChange,
        addMessage,
        isLoading,
    } = useContext(ChatContext)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [isFocused, setIsFocused] = React.useState(false)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
        }
    }, [message])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (message.trim() && !isDisabled && !isLoading) {
            addMessage()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const canSend = message.trim() && !isDisabled && !isLoading

    return (
        <div className='p-4 space-y-3'>
            {/* Input Container */}
            <form onSubmit={handleSubmit} className='relative'>
                <div className={cn(
                    'relative flex items-end gap-3 p-3 rounded-2xl border-2 transition-all duration-300 backdrop-blur-sm',
                    'bg-white/70 border-[#DBE2EF]/50 shadow-sm',
                    {
                        'border-[#3F72AF]/50 bg-white/90 shadow-md': isFocused,
                        'border-[#DBE2EF]/30 bg-white/50': !isFocused,
                        'opacity-50 cursor-not-allowed': isDisabled
                    }
                )}>
                    
                    {/* Text Input */}
                    <div className='flex-1 relative'>
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            disabled={isDisabled}
                            placeholder={isDisabled ? "Upload documents to start chatting..." : "Ask me anything about your documents..."}
                            className={cn(
                                'w-full resize-none border-0 bg-transparent text-[#112D4E] placeholder-[#3F72AF]/50',
                                'focus:outline-none focus:ring-0 text-sm leading-relaxed',
                                'min-h-[24px] max-h-[120px] scrollbar-thin scrollbar-thumb-[#DBE2EF] scrollbar-track-transparent',
                                {
                                    'cursor-not-allowed': isDisabled
                                }
                            )}
                            rows={1}
                        />

                        {/* Character Count */}
                        {message.length > 0 && (
                            <div className='absolute bottom-0 right-0 text-xs text-[#3F72AF]/50'>
                                {message.length}/2000
                            </div>
                        )}
                    </div>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={!canSend}
                        className={cn(
                            'flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 flex-shrink-0',
                            'shadow-sm transform',
                            {
                                'bg-gradient-to-r from-[#3F72AF] to-[#112D4E] text-white hover:shadow-md hover:scale-105 active:scale-95': canSend,
                                'bg-[#DBE2EF]/50 text-[#3F72AF]/50 cursor-not-allowed': !canSend
                            }
                        )}
                    >
                        {isLoading ? (
                            <Square className='w-4 h-4 animate-pulse' />
                        ) : (
                            <Send className='w-4 h-4' />
                        )}
                    </button>
                </div>

                {/* Background Glow Effect */}
                {isFocused && (
                    <div className='absolute inset-0 bg-gradient-to-r from-[#3F72AF]/10 via-[#DBE2EF]/10 to-[#3F72AF]/10 rounded-2xl blur-xl -z-10 animate-pulse'></div>
                )}
            </form>
        </div>
    )
}

export default ChatInput