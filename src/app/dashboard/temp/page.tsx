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

    // All hooks must be called unconditionally
    const [showEditModal, setShowEditModal] = useState(false);
    const [categories, setCategories] = useState<CategoryType[]>([]);
    const [questions, setQuestions] = useState<QuestionType[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [reviewName, setReviewName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [reviewToDelete, setReviewToDelete] = useState<ScoringSession | null>(null);

    const user_id = userId || "";
    const { data: reviews, refetch } = trpc.review.getReviews.useQuery({ user_id }, { enabled: !!user_id });
    const { data: category, refetch: catRefetch } = trpc.category.getCategories.useQuery({ user_id }, { enabled: !!user_id });
    const { data: question, refetch: QustionRefetch } = trpc.question.getQuestions.useQuery({ user_id }, { enabled: !!user_id });
    const createReviewMutation = trpc.review.createReview.useMutation();
    const deleteReviewMutation = trpc.review.deleteReview.useMutation();

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (category) setCategories(category);
    }, [category]);

    useEffect(() => {
        if (question) setQuestions(question);
    }, [question]);
    const backgrounds = ["bg-lime-50", "bg-emerald-50", "bg-yellow-50", "bg-indigo-50", "bg-purple-50", "bg-orange-50"];

    const handleNewReview = async () => {
        setIsDialogOpen(true);
    };

    const handleCreateReview = async () => {
        if (!reviewName.trim()) return;

        try {
            setIsCreating(true);
            const scoringSessionId = uuidv4();
            // Call tRPC mutation.
            const review = await createReviewMutation.mutateAsync({
                user_id,
                scoringSessionId,
                name: reviewName.trim(),
                scores: [],
    answers: [],
            });
            setIsDialogOpen(false);
            setReviewName("");
            router.push(`/dashboard/temp/${review.scoringSessionId}`);
        } catch (error) {
            console.error("Failed to create new review:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteReview = async (review: ScoringSession) => {
        if (!review) return;
        try {
            await deleteReviewMutation.mutateAsync({
                user_id: review.user_id,
                createdAt: review.createdAt,
            });
            // Refetch reviews after deletion.
            refetch();
        } catch (error) {
            console.error("Failed to delete review:", error);
        } finally {
            setReviewToDelete(null);
        }
    };

    // Only render null/loading here, after all hooks
    if (!isLoaded || !isSignedIn || !userId) {
        return null; // or a loading state
    }

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
                            <Button onClick={handleNewReview}>New Review</Button>
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
                                        value={reviewName}
                                        onChange={(e) => setReviewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !isCreating && reviewName.trim()) {
                                                handleCreateReview();
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
                                    <Button onClick={handleCreateReview} disabled={isCreating}>
                                        {isCreating ? "Creating..." : "Proceed"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {reviews?.length === 0 && (
                            <div className="col-span-full text-center p-8 text-gray-500">
                                No reviews yet. Create a new review to get started!
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reviews?.map((review, idx) => (
                                <Card key={review.scoringSessionId} className={`hover:shadow-lg transition-shadow ${backgrounds[idx % backgrounds.length]}`}>
                                    <CardHeader>
                                        <CardTitle className="truncate">{review.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col min-h-40 justify-between">
                                            <p className="text-sm text-gray-500">
                                                Created on {new Date(review.createdAt).toLocaleDateString()}
                                            </p>
                                            <div className="flex gap-2 justify-between">
                                                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/temp/${review.scoringSessionId}`)}>
                                                    Open
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="bg-red-500"
                                                    onClick={() => {
                                                        setReviewToDelete(review);
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

                        <AlertDialog open={!!reviewToDelete} onOpenChange={() => setReviewToDelete(null)}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will permanently delete the review "{reviewToDelete?.name}". This cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600"
                                        onClick={() => reviewToDelete && handleDeleteReview(reviewToDelete)}
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