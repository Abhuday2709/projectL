"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Chat } from "../../../models/chatModel";
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
import { trpc } from "../_trpc/client";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";

export default function DashboardPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const user_id = userId || "";
    // Redirect to sign-in if not authenticated.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [chatName, setChatName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);

    // Fetch chats using tRPC query instead of SWR if you prefer.
    const { data: chats, refetch } = trpc.chat.getChats.useQuery({ user_id });
    const createChatMutation = trpc.chat.createChat.useMutation();
    const deleteChatMutation = trpc.chat.deleteChat.useMutation();

    const backgrounds = ["bg-lime-50","bg-emerald-50","bg-yellow-50","bg-indigo-50","bg-purple-50","bg-orange-50"];

    // const getBgClass = (id: string) => {
    //     let sum = 0;
    //     for (let i = 0; i < id.length; i++) {
    //         sum += id.charCodeAt(i);
    //     }
    //     return backgrounds[sum % backgrounds.length];
    // };

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
            router.push(`/chat/${chat.chatId}`);
        } catch (error) {
            console.error("Failed to create new chat:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteChat = async (chat: Chat) => {
        if (!chat) return;
        try {
            await deleteChatMutation.mutateAsync({
                user_id: chat.user_id,
                createdAt: chat.createdAt,
            });
            // Refetch chats after deletion.
            refetch();
        } catch (error) {
            console.error("Failed to delete chat:", error);
        } finally {
            setChatToDelete(null);
        }
    };

    if (!isLoaded || !isSignedIn) return null;

    return (
        <MaxWidthWrapper>
        <div className="p-8">
            {/* Your header, dialog, etc. */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-semibold">Your Chats</h1>
                <Button onClick={handleNewChat}>New Chat</Button>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Chat</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Enter chat name"
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isCreating && chatName.trim()) {
                                    handleCreateChat();
                                }
                            }}
                            required
                            aria-required="true"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateChat} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Proceed"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {chats?.length === 0 && (
                <div className="col-span-full text-center p-8 text-gray-500">
                    No chats yet. Create a new chat to get started!
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {chats?.map((chat,idx) => (
                    <Card key={chat.chatId} className={`hover:shadow-lg transition-shadow ${backgrounds[idx % backgrounds.length]}`}>
                        <CardHeader>
                            <CardTitle className="truncate">{chat.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col min-h-40 justify-between">
                            <p className="text-sm text-gray-500">
                                Created on {new Date(chat.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex gap-2 justify-between">
                                <Button variant="outline" size="sm" onClick={() => router.push(`/chat/${chat.chatId}`)}>
                                    Open
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="bg-red-500"
                                    onClick={() => {
                                        setChatToDelete(chat);
                                    }}
                                >
                                    Delete
                                </Button>
                            </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* AlertDialog for Delete Confirmation */}
            <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will permanently delete the chat "{chatToDelete?.name}". This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => chatToDelete && handleDeleteChat(chatToDelete)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
        </MaxWidthWrapper>
    );
}