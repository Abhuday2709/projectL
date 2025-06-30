"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Chat } from "../../../../models/chatModel";
import type { Message } from "../../../../models/messageModel";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Sidebar from "@/components/Sidebar";
import { MessageCircle, Plus, Trash2, Calendar, ArrowRight, Loader2, MessageSquare, User, Bot, Copy, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

export default function DashboardChatPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const user_id = userId || "";
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [chatName, setChatName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [chats, setChats] = useState<Chat[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Q&A Dialog states
    const [qaDialogOpen, setQaDialogOpen] = useState(false);
    const [qaMessages, setQaMessages] = useState<Message[]>([]);
    const [isLoadingQA, setIsLoadingQA] = useState(false);
    const [selectedChatForQA, setSelectedChatForQA] = useState<Chat | null>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    const fetchChats = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/chat/getChat');
            if (!res.ok) throw new Error('Failed to fetch chats');
            const data: Chat[] = await res.json();
            setChats(data);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not load chats.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchQAMessages = async (chatId: string) => {
        setIsLoadingQA(true);
        try {
            const res = await fetch(`/api/message/getQAMessages?chatId=${chatId}`);
            if (!res.ok) throw new Error('Failed to fetch Q&A messages');
            const data = await res.json();
            setQaMessages(data.messages || []);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not load Q&A messages.', variant: 'destructive' });
        } finally {
            setIsLoadingQA(false);
        }
    };

    const handleViewQA = async (chat: Chat) => {
        setSelectedChatForQA(chat);
        setQaDialogOpen(true);
        await fetchQAMessages(chat.chatId);
    };

    const handleCopyMessage = async (messageId: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    };

    useEffect(() => {
        if (isLoaded && isSignedIn) fetchChats();
    }, [isLoaded, isSignedIn]);

    const handleNewChat = async () => {
        setIsDialogOpen(true);
    };

    const handleCreateChat = async () => {
        if (!chatName.trim()) return;
        setIsCreating(true);
        try {
            const chatId = uuidv4();
            const res = await fetch('/api/chat/createChat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, name: chatName.trim() }),
            });
            if (!res.ok) throw new Error('Failed to create chat');
            const newChat: Chat = await res.json();
            setIsDialogOpen(false);
            setChatName('');
            setIsPageLoading(true);
            router.push(`/dashboard/sendProposals/${newChat.chatId}`);
        } catch (error) {
            console.error(error);
            toast({ title: 'Failed to create chat', description: 'Please try again.', variant: 'destructive' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteChat = async (chat: Chat) => {
        setIsDeleting(true);
        try {
            const res = await fetch('/api/chat/deleteChat', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: chat.user_id, createdAt: chat.createdAt }),
            });
            if (!res.ok) throw new Error('Failed to delete chat');
            await fetchChats();
        } catch (error) {
            console.error(error);
            toast({ title: 'Failed to delete chat', description: 'Please try again.', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
            setChatToDelete(null);
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // User Message Component for Q&A Dialog
    const QAUserMessage = ({ message }: { message: Message }) => (
        <div className='flex items-start gap-3 justify-end group'>
            {/* Message Content */}
            <div className="flex flex-col max-w-[85%] sm:max-w-[70%] md:max-w-[60%] order-1 items-end">
                {/* Message Bubble */}
                <div 
                    className={cn(
                        'px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm transition-all duration-300 relative overflow-hidden',
                        'bg-gradient-to-r from-[#3F72AF] to-[#112D4E] text-white',
                        'hover:shadow-md hover:scale-[1.02] transform'
                    )}
                >
                    {/* Background Pattern */}
                    <div className='absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[length:20px_20px] opacity-30'></div>
                    
                    {/* Message Text */}
                    <div className='relative z-10'>
                        <p className='text-sm leading-relaxed break-words whitespace-pre-wrap'>
                            {message.text}
                        </p>
                    </div>

                    {/* Decorative Corner */}
                    <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-transparent to-white/10 rounded-tl-2xl'></div>
                </div>

                {/* Message Info */}
                <div className={cn(
                    'flex items-center gap-2 text-xs text-[#3F72AF]/70 transition-opacity duration-300',
                    'opacity-0 group-hover:opacity-100'
                )}>
                    <span>{formatTime(message.createdAt)}</span>
                    <Check className='h-3 w-3' />
                </div>
            </div>

            {/* User Avatar */}
            <div className={cn(
                'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full order-2 shadow-sm transition-all duration-300',
                'bg-gradient-to-r from-[#3F72AF] to-[#112D4E] text-white',
                'hover:shadow-md hover:scale-110 transform',
            )}>
                <User className='w-4 h-4 sm:w-5 sm:h-5' />
            </div>
        </div>
    );

    // AI Message Component for Q&A Dialog
    const QAAIMessage = ({ message }: { message: Message }) => (
        <div className='flex items-start gap-3 group'>
            {/* Avatar */}
            <div className={cn(
                'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full order-1 shadow-sm transition-all duration-300 flex-shrink-0',
                'bg-gradient-to-r from-[#DBE2EF] to-[#F9F7F7] border-2 border-[#3F72AF]/20',
                'hover:shadow-md hover:scale-110 transform',
            )}>
                <Bot className='w-4 h-4 sm:w-5 sm:h-5 text-[#3F72AF]' />
            </div>
        
            {/* Message Bubble */}
            <div className="flex flex-col space-y-2 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] order-2 items-start">
                <div 
                    className={cn(
                        'px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm transition-all duration-300 relative overflow-hidden',
                        'bg-white/80 backdrop-blur-sm border border-[#DBE2EF]/50 text-[#112D4E]',
                        'hover:shadow-md hover:bg-white/90 transform'
                    )}
                >
                    {/* Background Pattern */}
                    <div className='absolute inset-0 bg-gradient-to-br from-[#F9F7F7]/50 to-transparent opacity-50'></div>
                    
                    {/* Content */}
                    <div className='relative z-10'>
                        {typeof(message.text) === 'string' ? (
                            <div className="prose prose-sm max-w-none">
                                <ReactMarkdown 
                                    components={{
                                        p: ({ children }) => <p className="text-[#112D4E] leading-relaxed mb-2 last:mb-0">{children}</p>,
                                        strong: ({ children }) => <strong className="text-[#112D4E] font-semibold">{children}</strong>,
                                        em: ({ children }) => <em className="text-[#3F72AF] italic">{children}</em>,
                                        code: ({ children }) => (
                                            <code className="bg-[#DBE2EF] text-[#112D4E] px-1.5 py-0.5 rounded text-xs font-mono">
                                                {children}
                                            </code>
                                        ),
                                        pre: ({ children }) => (
                                            <pre className="bg-[#112D4E] text-[#F9F7F7] p-3 rounded-lg overflow-x-auto text-sm font-mono">
                                                {children}
                                            </pre>
                                        ),
                                    }}
                                >
                                    {message.text}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            message.text
                        )}
                    </div>

                    {/* Decorative Corner */}
                    <div className='absolute -bottom-1 -left-1 w-4 h-4 bg-gradient-to-tr from-transparent to-[#DBE2EF]/20 rounded-br-2xl'></div>
                </div>

                {/* Meta Info */}
                <div className={cn(
                    'flex items-center gap-3 text-xs text-[#3F72AF]/70 transition-opacity duration-300',
                    'opacity-0 group-hover:opacity-100'
                )}>
                    <span>{formatTime(message.createdAt)}</span>
                    <button
                        onClick={() => handleCopyMessage(message.messageId, message.text)}
                        className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200',
                            'hover:bg-[#DBE2EF]/30 hover:text-[#3F72AF]',
                            { 'text-green-600': copiedMessageId === message.messageId, 'text-[#3F72AF]/70': copiedMessageId !== message.messageId }
                        )}
                    >
                        {copiedMessageId === message.messageId ? (
                            <><Check className='h-3 w-3' /><span>Copied!</span></>
                        ) : (
                            <><Copy className='h-3 w-3' /><span>Copy</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    useEffect(() => {
        setIsPageLoading(false);
    }, [router]);

    if (!isLoaded || !isSignedIn) return null;

    return (
        <>
            {isPageLoading && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
                </div>
            )}
            <div className="flex bg-[#F9F7F7]">
                <Sidebar />
                <div className="flex-1 lg:ml-64">
                    <MaxWidthWrapper>
                        <div className="p-8">
                            {/* Header Section */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                            <MessageCircle className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-bold text-[#112D4E]">Your Chats</h1>
                                            <p className="text-[#3F72AF] mt-1">
                                                {chats?.length ? `${chats.length} conversation${chats.length !== 1 ? 's' : ''}` : 'No conversations yet'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleNewChat}
                                        className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A94] hover:to-[#0D1F35] shadow-lg hover:shadow-xl transition-all duration-200 text-white"
                                        size="lg"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Chat
                                    </Button>
                                </div>
                            </div>

                            {/* Loading State */}
                            {isLoading && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {[...Array(6)].map((_, i) => (
                                        <Card key={i} className="animate-pulse bg-white border border-[#DBE2EF]">
                                            <CardHeader>
                                                <div className="h-6 bg-[#DBE2EF] rounded w-3/4"></div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    <div className="h-4 bg-[#DBE2EF] rounded w-1/2"></div>
                                                    <div className="flex gap-2 pt-8">
                                                        <div className="h-8 bg-[#DBE2EF] rounded flex-1"></div>
                                                        <div className="h-8 bg-[#DBE2EF] rounded w-16"></div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && chats?.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                    <div className="p-4 bg-[#DBE2EF] rounded-full mb-6">
                                        <MessageCircle className="h-12 w-12 text-[#3F72AF]" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-[#112D4E] mb-2">No conversations yet</h3>
                                    <p className="text-[#3F72AF] mb-6 text-center max-w-md">
                                        Start your first conversation to begin collaborating and sharing ideas.
                                    </p>
                                    <Button
                                        onClick={handleNewChat}
                                        className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A94] hover:to-[#0D1F35] text-white"
                                        size="lg"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Your First Chat
                                    </Button>
                                </div>
                            )}

                            {/* Chat Grid */}
                            {!isLoading && chats && chats.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {chats.map((chat, idx) => (
                                        <Card
                                            key={chat.chatId}
                                            className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 bg-white border-[#DBE2EF] hover:border-[#3F72AF] hover:shadow-[#3F72AF]/20`}
                                        >
                                            <CardHeader className="pb-3">
                                                <CardTitle className="flex items-start justify-between">
                                                    <span className="truncate text-[#112D4E] font-semibold pr-2">
                                                        {chat.name}
                                                    </span>
                                                    <ArrowRight className="h-4 w-4 text-[#3F72AF] group-hover:text-[#112D4E] group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-col min-h-32 justify-between">
                                                    <div className="flex items-center gap-2 text-sm text-[#3F72AF] mb-4">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>
                                                            {formatDate(chat.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white transition-colors"
                                                            onClick={() => {
                                                                setIsPageLoading(true);
                                                                router.push(`/dashboard/sendProposals/${chat.chatId}`);
                                                            }}
                                                        >
                                                            Open
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="bg-[#F9F7F7] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#3F72AF] hover:text-white transition-colors"
                                                            onClick={() => handleViewQA(chat)}
                                                        >
                                                            <MessageSquare className="h-4 w-4 mr-1" />
                                                            Q&A
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="p-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors border-[#DBE2EF] text-[#3F72AF]"
                                                            onClick={() => setChatToDelete(chat)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* Q&A Dialog */}
                            <Dialog open={qaDialogOpen} onOpenChange={setQaDialogOpen}>
                                <DialogContent className="max-w-4xl max-h-[80vh] bg-gray-200">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <div className="p-2 bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-lg">
                                                <MessageSquare className="h-4 w-4 text-white" />
                                            </div>
                                            <span className="text-[#112D4E]">Q&A for "{selectedChatForQA?.name}"</span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    
                                    <div className="flex-1 overflow-y-auto max-h-[60vh] p-4 bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] rounded-lg">
                                        {isLoadingQA ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="flex items-center gap-3 text-[#3F72AF]">
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                    <span className="text-sm">Loading Q&A...</span>
                                                </div>
                                            </div>
                                        ) : qaMessages.length === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="p-4 bg-[#DBE2EF] rounded-full mb-4 w-fit mx-auto">
                                                    <MessageSquare className="h-8 w-8 text-[#3F72AF]" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-[#112D4E] mb-2">No Q&A Available</h3>
                                                <p className="text-[#3F72AF]">
                                                    Client has not asked any questions yet.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {qaMessages.map((message, index) => (
                                                    <div key={message.messageId}>
                                                        {message.isUserMessage ? (
                                                            <QAUserMessage message={message} />
                                                        ) : (
                                                            <QAAIMessage message={message} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button
                                            onClick={() => setQaDialogOpen(false)}
                                            className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A94] hover:to-[#0D1F35] text-white"
                                        >
                                            Close
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Create Chat Dialog */}
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogContent className="sm:max-w-md bg-white border-[#DBE2EF]">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                                <Plus className="h-4 w-4 text-white" />
                                            </div>
                                            <span className="text-[#112D4E]">Create New Chat</span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Input
                                            placeholder="Enter a descriptive chat name..."
                                            value={chatName}
                                            onChange={(e) => setChatName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !isCreating && chatName.trim()) {
                                                    handleCreateChat();
                                                }
                                            }}
                                            required
                                            aria-required="true"
                                            className="h-12 border-[#DBE2EF] focus:border-[#3F72AF] focus:ring-[#3F72AF] text-[#112D4E]"
                                            autoFocus
                                        />
                                    </div>
                                    <DialogFooter className="gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsDialogOpen(false)}
                                            disabled={isCreating}
                                            className="border-[#DBE2EF] text-[#3F72AF] hover:bg-[#DBE2EF] hover:text-[#112D4E]"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreateChat}
                                            disabled={isCreating || !chatName.trim()}
                                            className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A94] hover:to-[#0D1F35] text-white flex items-center"
                                        >
                                            {isCreating && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                            {isCreating ? "Creating..." : "Create Chat"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Delete Confirmation Dialog */}
                            <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
                                <AlertDialogContent className="bg-white border-[#DBE2EF]">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                            <div className="p-2 bg-red-100 rounded-lg">
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </div>
                                            <span className="text-[#112D4E]">Delete Chat?</span>
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-base text-[#3F72AF]">
                                            Are you sure you want to delete <span className="font-semibold text-[#112D4E]">"{chatToDelete?.name}"</span>?
                                            This action cannot be undone and will permanently remove all messages in this conversation.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel
                                            className="border-[#DBE2EF] text-[#3F72AF] hover:bg-[#DBE2EF] hover:text-[#112D4E]"
                                            disabled={isDeleting}
                                        >
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700 text-white flex items-center"
                                            onClick={() => chatToDelete && handleDeleteChat(chatToDelete)}
                                            disabled={isDeleting}
                                        >
                                            {isDeleting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {isDeleting ? "Deleting..." : "Delete Chat"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </MaxWidthWrapper>
                </div>
            </div>
        </>
    );
}