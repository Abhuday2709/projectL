'use client'
import React from 'react'
import ChatInput from './ChatInput'
import Messages from './Messages'
import { FileX, Upload, Sparkles, Loader2 } from 'lucide-react'
import { ChatContextProvider } from './ChatContext'
import { DocumentWithStatus } from '@/lib/utils' // Make sure this type is correctly imported or defined

interface ChatWrapperProps {
    chatId: string
    documentsWithStatus: DocumentWithStatus[]
    isAnyDocumentProcessing: boolean
}

/**
 * Main chat container component.
 * Renders UI based on document processing status and availability.
 * @param chatId - Unique identifier for chat session
 * @param documentsWithStatus - Array of documents with their processing status
 * @param isAnyDocumentProcessing - Flag indicating if any document is currently being processed
 */
const ChatWrapper = ({
    chatId,
    documentsWithStatus,
    isAnyDocumentProcessing,
}: ChatWrapperProps) => {
    const completedDocuments = documentsWithStatus.filter(
        (doc) => doc.processingStatus === 'COMPLETED'
    )

    // Case 1: A document is processing, and no documents are ready yet.
    // Show a full-screen loading state.
    if (isAnyDocumentProcessing && completedDocuments.length === 0) {
        return (
            <div className='relative min-h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)] bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-2xl flex flex-col justify-center items-center gap-4 text-center p-4 shadow-lg border border-[#DBE2EF]/30'>
                <Loader2 className='h-10 w-10 text-[#3F72AF] animate-spin' />
                <h3 className='font-bold text-2xl text-[#112D4E]'>
                    Processing your document...
                </h3>
                <p className='text-[#3F72AF]/80 text-base max-w-md'>
                    Please wait a moment. This page will update automatically.
                </p>
            </div>
        )
    }

    // Case 2: No documents are processed and ready. Show the empty state.
    if (completedDocuments.length === 0) {
        return (
            <div className='relative min-h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)] bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-2xl flex flex-col justify-between gap-2 shadow-lg border border-[#DBE2EF]/30'>
                <div className='flex-1 flex justify-center items-center flex-col px-4'>
                    <div className='flex flex-col items-center gap-6 text-center max-w-md'>
                        {/* Icon */}
                        <div className='relative top-5'>
                            <div className='absolute inset-0 bg-[#3F72AF]/20 rounded-full animate-ping'></div>
                            <div className='relative bg-gradient-to-r from-[#3F72AF] to-[#112D4E] p-4 rounded-full shadow-lg'>
                                <FileX className='h-8 w-8 text-white' />
                            </div>
                        </div>

                        {/* Header */}
                        <div className='space-y-2'>
                            <h3 className='font-bold text-2xl text-[#112D4E]'>
                                No Documents Ready
                            </h3>
                            <p className='text-[#3F72AF]/80 text-base leading-relaxed'>
                                Upload documents to start an intelligent conversation with AI.
                            </p>
                        </div>

                        {/* Features */}
                        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6'>
                            <div className='bg-white/40 backdrop-blur-sm rounded-lg p-3 text-center border border-[#DBE2EF]/30'>
                                <Sparkles className='h-5 w-5 text-[#3F72AF] mx-auto mb-1' />
                                <p className='text-xs text-[#112D4E] font-medium'>AI Analysis</p>
                            </div>
                            <div className='bg-white/40 backdrop-blur-sm rounded-lg p-3 text-center border border-[#DBE2EF]/30'>
                                <FileX className='h-5 w-5 text-[#3F72AF] mx-auto mb-1' />
                                <p className='text-xs text-[#112D4E] font-medium'>Smart Search</p>
                            </div>
                            <div className='bg-white/40 backdrop-blur-sm rounded-lg p-3 text-center border border-[#DBE2EF]/30'>
                                <Upload className='h-5 w-5 text-[#3F72AF] mx-auto mb-1' />
                                <p className='text-xs text-[#112D4E] font-medium'>Quick Upload</p>
                            </div>
                        </div>
                    </div>
                </div>
                <ChatInput isDisabled />
            </div>
        )
    }

    // Case 3: At least one document is ready. Show the chat interface.
    return (
        <ChatContextProvider chatId={chatId}>
            <div className='relative h-[calc(100vh-11rem)] bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-2xl flex flex-col shadow-lg border border-[#DBE2EF]/30 overflow-hidden'>
                {/* Header with optional processing indicator */}
                <div className='flex-shrink-0 bg-white/50 backdrop-blur-sm border-b border-[#DBE2EF]/50 px-4 py-3'>
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <div className='bg-gradient-to-r from-[#3F72AF] to-[#112D4E] p-2 rounded-lg shadow-sm'>
                                <Sparkles className='h-4 w-4 text-white' />
                            </div>
                            <div>
                                <h2 className='font-semibold text-[#112D4E] text-sm'>AI Assistant</h2>
                                <p className='text-xs text-[#3F72AF]/70'>Ready to help with your documents</p>
                            </div>
                        </div>
                        {isAnyDocumentProcessing && (
                            <div className='flex items-center gap-2 text-xs text-blue-600'>
                                <Loader2 className='h-4 w-4 animate-spin' />
                                <span>Processing...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages Container */}
                <div className='flex-grow overflow-hidden'>
                    <Messages />
                </div>

                {/* Input Container */}
                <div className='flex-shrink-0 border-t border-[#DBE2EF]/50 bg-white/30 backdrop-blur-sm'>
                    <ChatInput isDisabled={false} />
                </div>
            </div>
        </ChatContextProvider>
    )
}

export default ChatWrapper