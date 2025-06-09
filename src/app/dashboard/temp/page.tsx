"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ScoringSession } from "../../../../models/scoringReviewModel";
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
import EditQuestionsAndCategories from "@/components/EditQuestionsAnd Categories";
import { CategoryType, QuestionType } from "@/lib/utils";

export default function DashboardChatPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const user_id = userId || "";
    // Redirect to sign-in if not authenticated.
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    const [showEditModal, setShowEditModal] = useState(false)
    const [categories, setCategories] = useState<CategoryType[]>([])
    const [questions, setQuestions] = useState<QuestionType[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [chatName, setChatName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [chatToDelete, setChatToDelete] = useState<ScoringSession | null>(null);

    // Fetch chats using tRPC query instead of SWR if you prefer.
    const { data: chats, refetch } = trpc.review.getReviews.useQuery({ user_id });
    const { data: category, refetch: catRefetch } = trpc.category.getCategories.useQuery({ user_id });
    const { data: question, refetch: QustionRefetch } = trpc.question.getQuestions.useQuery({ user_id });
    const createChatMutation = trpc.chat.createChat.useMutation();
    const deleteChatMutation = trpc.chat.deleteChat.useMutation();
    useEffect(() => {
        if (category) setCategories(category);
    }, [category]);

    useEffect(() => {
        if (question) setQuestions(question);
    }, [question]);
    const backgrounds = ["bg-lime-50", "bg-emerald-50", "bg-yellow-50", "bg-indigo-50", "bg-purple-50", "bg-orange-50"];

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
            router.push(`/dashboard/temp/${chat.chatId}`);
        } catch (error) {
            console.error("Failed to create new chat:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteChat = async (chat: ScoringSession) => {
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
        <div className="flex z-50">
            <Sidebar />
            <div className="flex-1 ml-64"> {/* Adjusted to account for sidebar width */}
                <MaxWidthWrapper>
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h1 className="text-3xl font-semibold">Your Reviews</h1>

                            <Button variant="outline" onClick={() => setShowEditModal(true)}>
                                Edit Questions
                            </Button>
                            <Button onClick={handleNewChat}>New Review</Button>
                        </div>
                        {/* Edit Questions Modal */}
                        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                            <DialogContent className="w-[100vw] max-w-[1200px] h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Categories & Questions</DialogTitle>
                                    <DialogDescription>
                                        Make changes to your categories and questions here. Click "Review & Confirm" to save.
                                    </DialogDescription>
                                </DialogHeader>
                                <EditQuestionsAndCategories
                                    userId={userId}
                                    categories={categories}
                                    questions={questions}
                                    onClose={async () => {
                                        setShowEditModal(false);
                                        await Promise.all([catRefetch(), QustionRefetch()]);
                                    }}
                                />
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Review</DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                    <Input
                                        placeholder="Enter review name"
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
                                No reviews yet. Create a new review to get started!
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {chats?.map((chat, idx) => (
                                <Card key={chat.scoringSessionId} className={`hover:shadow-lg transition-shadow ${backgrounds[idx % backgrounds.length]}`}>
                                    <CardHeader>
                                        <CardTitle className="truncate">{chat.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col min-h-40 justify-between">
                                            <p className="text-sm text-gray-500">
                                                Created on {new Date(chat.createdAt).toLocaleDateString()}
                                            </p>
                                            <div className="flex gap-2 justify-between">
                                                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/temp/${chat.scoringSessionId}`)}>
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

                        <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will permanently delete the review "{chatToDelete?.name}". This cannot be undone.
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
            </div>
        </div>
    );
}