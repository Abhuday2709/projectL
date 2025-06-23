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
import { ClipboardList, Plus, Trash2, Calendar, ArrowRight, Settings, FileText } from "lucide-react";

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
    const { data: reviews, refetch, isLoading } = trpc.review.getReviews.useQuery({ user_id }, { enabled: !!user_id });
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

    const gradients = [
        "bg-gradient-to-br from-lime-50 to-lime-100 border-lime-200",
        "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200",
        "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200",
        "bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200",
        "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200",
        "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200",
        "bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200",
        "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
    ];

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
        <div className="flex min-h-screen bg-[#F9F7F7]">
            <Sidebar />
            <div className="flex-1 lg:ml-64 transition-all duration-200">
                <MaxWidthWrapper>
                    <div className="p-8">
                        {/* Header Section */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                        <ClipboardList className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-[#112D4E]">Your Reviews</h1>
                                        <p className="text-[#3F72AF] mt-1">
                                            {reviews?.length ? `${reviews.length} review session${reviews.length !== 1 ? 's' : ''}` : 'No review sessions yet'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowEditModal(true)}
                                        className="hover:bg-[#DBE2EF] border-[#3F72AF] text-[#3F72AF]"
                                    >
                                        <Settings className="h-4 w-4 mr-2" />
                                        Edit Questions
                                    </Button>
                                    <Button 
                                        onClick={handleNewReview}
                                        className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32] shadow-lg hover:shadow-xl transition-all duration-200"
                                        size="lg"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Review
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Edit Questions Modal */}
                        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                            <DialogContent className="w-[100vw] max-w-[1200px] h-[90vh] overflow-y-auto bg-[#F9F7F7]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-[#112D4E]">
                                        <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                            <Settings className="h-4 w-4 text-white" />
                                        </div>
                                        Edit Categories & Questions
                                    </DialogTitle>
                                    <DialogDescription className="text-[#3F72AF]">
                                        Make changes to your categories and questions here. Click "Review & Confirm" to save your changes.
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

                        {/* Loading State */}
                        {isLoading && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(6)].map((_, i) => (
                                    <Card key={i} className="animate-pulse bg-white border-[#DBE2EF]">
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
                        {!isLoading && reviews?.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                <div className="p-4 bg-gradient-to-r from-[#DBE2EF] to-[#F9F7F7] rounded-full mb-6">
                                    <ClipboardList className="h-12 w-12 text-[#3F72AF]" />
                                </div>
                                <h3 className="text-xl font-semibold text-[#112D4E] mb-2">No review sessions yet</h3>
                                <p className="text-[#3F72AF] mb-6 text-center max-w-md">
                                    Create your first review session to start evaluating and scoring content or submissions.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button 
                                        variant="outline"
                                        onClick={() => setShowEditModal(true)}
                                        className="hover:bg-[#DBE2EF] border-[#3F72AF] text-[#3F72AF]"
                                    >
                                        <Settings className="h-4 w-4 mr-2" />
                                        Setup Questions First
                                    </Button>
                                    <Button 
                                        onClick={handleNewReview}
                                        className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32]"
                                        size="lg"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Your First Review
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Reviews Grid */}
                        {!isLoading && reviews && reviews.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {reviews.map((review, idx) => (
                                    <Card 
                                        key={review.scoringSessionId} 
                                        className={`group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 bg-white border-[#DBE2EF] hover:border-[#3F72AF]`}
                                        onClick={() => router.push(`/dashboard/temp/${review.scoringSessionId}`)}
                                    >
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-start justify-between">
                                                <div className="flex items-start gap-2">
                                                    <FileText className="h-4 w-4 text-[#3F72AF] mt-1 flex-shrink-0" />
                                                    <span className="truncate text-[#112D4E] font-semibold">
                                                        {review.name}
                                                    </span>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-[#3F72AF] group-hover:text-[#112D4E] group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-col min-h-32 justify-between">
                                                <div className="space-y-2 mb-4">
                                                    <div className="flex items-center gap-2 text-sm text-[#3F72AF]">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>
                                                            {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                    {(review.scores?.length > 0 || review.answers?.length > 0) && (
                                                        <div className="flex items-center gap-2 text-sm text-[#3F72AF]">
                                                            <div className="w-2 h-2 bg-[#3F72AF] rounded-full"></div>
                                                            <span className="font-medium">
                                                                {review.scores?.length || review.answers?.length} responses
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="flex-1 bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/temp/${review.scoringSessionId}`);
                                                        }}
                                                    >
                                                        Open
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-2 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors border-[#DBE2EF]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReviewToDelete(review);
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

                        {/* Create Review Dialog */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogContent className="sm:max-w-md bg-[#F9F7F7]">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-[#112D4E]">
                                        <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                                            <Plus className="h-4 w-4 text-white" />
                                        </div>
                                        Create New Review
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                    <Input
                                        placeholder="Enter a descriptive review session name..."
                                        value={reviewName}
                                        onChange={(e) => setReviewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !isCreating && reviewName.trim()) {
                                                handleCreateReview();
                                            }
                                        }}
                                        required
                                        aria-required="true"
                                        className="h-12 border-[#DBE2EF] focus:border-[#3F72AF]"
                                        autoFocus
                                    />
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setIsDialogOpen(false)} 
                                        disabled={isCreating}
                                        className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF]"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={handleCreateReview} 
                                        disabled={isCreating || !reviewName.trim()}
                                        className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32]"
                                    >
                                        {isCreating ? "Creating..." : "Create Review"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Delete Confirmation Dialog */}
                        <AlertDialog open={!!reviewToDelete} onOpenChange={() => setReviewToDelete(null)}>
                            <AlertDialogContent className="bg-[#F9F7F7]">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2 text-[#112D4E]">
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </div>
                                        Delete Review Session?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-base text-[#3F72AF]">
                                        Are you sure you want to delete <span className="font-semibold text-[#112D4E]">"{reviewToDelete?.name}"</span>? 
                                        This action cannot be undone and will permanently remove all scores, answers, and data associated with this review session.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF]">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => reviewToDelete && handleDeleteReview(reviewToDelete)}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Review
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