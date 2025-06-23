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
import { trpc } from "../../_trpc/client";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Sidebar from "@/components/Sidebar";
import { MessageCircle, Plus, Trash2, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardChatPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const user_id = userId || "";
    const { toast } = useToast();
    // Redirect to sign-in if not authenticated.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [chatName, setChatName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
    const [isDeleting, setIsDeleting] = useState(false); // Add this state

    // Fetch chats using tRPC query instead of SWR if you prefer.
    const { data: chats, refetch, isLoading } = trpc.chat.getChats.useQuery({ user_id });
    const createChatMutation = trpc.chat.createChat.useMutation();
    const deleteChatMutation = trpc.chat.deleteChat.useMutation();

    const handleNewChat = async () => {
        setIsDialogOpen(true);
    };

    const handleCreateChat = async () => {
        if (!chatName.trim()) return;

        try {
            setIsCreating(true);
            const chatId = uuidv4();
            // Call tRPC mutation.
            const chat = await createChatMutation.mutateAsync({
                user_id,
                chatId,
                name: chatName.trim(),
            });
            setIsDialogOpen(false);
            setChatName("");
            router.push(`/dashboard/sendProposals/${chat.chatId}`);
        } catch (error) {
            console.error("Failed to create new chat:", error);
            toast({
                title: "Failed to create chat",
                description: "Something went wrong while creating the chat. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteChat = async (chat: Chat) => {
        if (!chat) return;
        setIsDeleting(true); // Start loading
        try {
            await deleteChatMutation.mutateAsync({
                user_id: chat.user_id,
                createdAt: chat.createdAt,
            });
            // Refetch chats after deletion.
            refetch();
        } catch (error) {
            console.error("Failed to delete chat:", error);
            toast({
                title: "Failed to delete chat",
                description: "Something went wrong while deleting the chat. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false); // End loading
            setChatToDelete(null);
        }
    };

    if (!isLoaded || !isSignedIn) return null;

    return (
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
                                        className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 bg-white border-[#DBE2EF] hover:border-[#3F72AF] hover:shadow-[#3F72AF]/20`}
                                        onClick={() => router.push(`/dashboard/sendProposals/${chat.chatId}`)}
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
                                                        {new Date(chat.createdAt).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/sendProposals/${chat.chatId}`);
                                                        }}
                                                    >
                                                        Open
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors border-[#DBE2EF] text-[#3F72AF]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setChatToDelete(chat);
                                                        }}
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
    );
}