'use client'
import React, { useState, useEffect } from 'react'
import ChatInput from './ChatInput'
import Messages from './Messages'
import { FileX, Upload, Sparkles } from 'lucide-react'
import { ChatContextProvider } from './ChatContext'
import { Document } from '@/models/documentModel'

interface ChatWrapperProps {
    chatId: string
}

const ChatWrapper = ({ chatId }: ChatWrapperProps) => {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState<boolean>(false)

    const fetchDocuments = () => {
        setLoading(true)
        fetch(`/api/documents/getDocuments?chatId=${encodeURIComponent(chatId)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`Error ${res.status}`)
                return res.json()
            })
            .then((data) => setDocuments(data))
            .catch((err) => console.error(err.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        if (!chatId) return
        fetchDocuments()
    }, [chatId])

    if (loading) return <div>Loading documents...</div>

    if (documents.length === 0) {
        return (
            <div className='relative min-h-[calc(100vh-11rem)] max-h-[calc(100vh-11rem)] bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-2xl flex flex-col justify-between gap-2 shadow-lg border border-[#DBE2EF]/30'>
                <div className='flex-1 flex justify-center items-center flex-col px-4'>
                    <div className='flex flex-col items-center gap-6 text-center max-w-md'>
                        {/* Animated Icon */}
                        <div className='relative top-5'>
                            <div className='absolute inset-0 bg-[#3F72AF]/20 rounded-full animate-ping'></div>
                            <div className='relative bg-gradient-to-r from-[#3F72AF] to-[#112D4E] p-4 rounded-full shadow-lg'>
                                <FileX className='h-8 w-8 text-white' />
                            </div>
                        </div>

                        {/* Header */}
                        <div className='space-y-2'>
                            <h3 className='font-bold text-2xl text-[#112D4E]'>
                                No Documents Found
                            </h3>
                            <p className='text-[#3F72AF]/80 text-base leading-relaxed'>
                                Upload your documents to start an intelligent conversation with AI
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

    return (
        <ChatContextProvider chatId={chatId}>
            <div className='relative h-[calc(100vh-11rem)] bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-2xl flex flex-col shadow-lg border border-[#DBE2EF]/30 overflow-hidden'>
                {/* Header */}
                <div className='flex-shrink-0 bg-white/50 backdrop-blur-sm border-b border-[#DBE2EF]/50 px-4 py-3'>
                    <div className='flex items-center gap-3'>
                        <div className='bg-gradient-to-r from-[#3F72AF] to-[#112D4E] p-2 rounded-lg shadow-sm'>
                            <Sparkles className='h-4 w-4 text-white' />
                        </div>
                        <div>
                            <h2 className='font-semibold text-[#112D4E] text-sm'>AI Assistant</h2>
                            <p className='text-xs text-[#3F72AF]/70'>Ready to help with your documents</p>
                        </div>
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
