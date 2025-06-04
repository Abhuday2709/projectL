'use client'

import { trpc } from '@/app/_trpc/client'
import ChatInput from './ChatInput'
import Messages from './Messages'
import { ChevronLeft, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '../ui/button'
import { ChatContextProvider } from './ChatContext'

interface ChatWrapperProps {
    chatId: string
}

const ChatWrapper = ({
    chatId,
}: ChatWrapperProps) => {
    const { data: documents = [], refetch } = trpc.documents.listByChat.useQuery({ chatId });
    if (documents.length === 0) {
        return (
            <div className='relative min-h-[calc(100vh-9rem)] max-h-[calc(100vh-9rem)] bg-zinc-50 flex divide-y divide-zinc-200 flex-col justify-between gap-2'>
                <div className='flex-1 flex justify-center items-center flex-col mb-28'>
                    <div className='flex flex-col items-center gap-2'>
                        <XCircle className='h-8 w-8 text-red-500' />
                        <h3 className='font-semibold text-xl'>
                            No documents uploaded
                        </h3>
                        <p className='text-zinc-500 text-sm'>
                            Please upload documents to start the chat.
                        </p>
                    </div>
                </div>

                <ChatInput isDisabled />
            </div>
        )
    }
    return (
        <ChatContextProvider chatId={chatId}>
            <div className='relative h-[calc(100vh-8.5rem)] bg-zinc-50 flex flex-col'>
                <div className='flex-grow overflow-y-auto'>
                    <Messages />
                </div>
                <div className='flex-shrink-0 border-t border-gray-200'>
                    <ChatInput isDisabled={false}/>
                </div>
            </div>
        </ChatContextProvider>
    )
}

export default ChatWrapper