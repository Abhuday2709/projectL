"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ScoringSession } from "@/models/scoringReviewModel";
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
import { QuestionType } from "@/lib/utils";
import { ClipboardList, Plus, Trash2, Loader2 } from "lucide-react";
import { ReviewCard } from "@/components/ReviewCard";
import { useToast } from "@/hooks/use-toast";
import { Category } from "@/models/categoryModel";

export default function DashboardReviewPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    // All hooks must be called unconditionally
    const [categories, setCategories] = useState<Category[]>([]);
    const [questions, setQuestions] = useState<QuestionType[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [reviewName, setReviewName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [reviewToDelete, setReviewToDelete] = useState<ScoringSession | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [question, setQuestion] = useState<QuestionType[]>([]);
    const [reviews, setReviews] = useState<ScoringSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const user_id = userId || "";
    const fetchQuestions = async () => {
        const res = await fetch(`/api/evaluation-questions?userId=${userId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        })
        if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || "adding questions failed")
        }
        const data = await res.json()
        // console.log("Fetched Questions:", data);

        setQuestion(data)
    }
    const fetchCategories = async () => {
        try {
            const res = await fetch(`/api/category/getCategories`)
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch')
            const data = await res.json()
            setAllCategories(data)
        } catch (err) {
            toast({ title: 'Error fetching categories', description: (err as Error).message, variant: 'destructive' })
        }
    }
    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/reviews?user_id=${user_id}`);
            if (!res.ok) throw new Error("Failed to fetch reviews");
            const data: ScoringSession[] = await res.json();
            setReviews(data);
        } catch (err) {
            toast({ title: 'Error fetching reviews', description: (err as Error).message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        if (userId) {
            fetchCategories()
            fetchQuestions()
            fetchReviews()
        }
    }, [userId])
    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (allCategories) setCategories(allCategories);
    }, [allCategories]);

    useEffect(() => {
        if (question) {
            setQuestions(question);
        }
    }, [question]);

    const handleNewReview = async () => {
        setIsDialogOpen(true);
    };

    const handleCreateReview = async () => {
        if (!reviewName.trim()) return;
        setIsCreating(true);
        try {
            const scoringSessionId = uuidv4();
            const payload = { user_id, scoringSessionId, name: reviewName.trim(), scores: [], answers: [], recommendation: "" };
            const res = await fetch(`/api/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to create review');
            const review: ScoringSession = await res.json();
            setIsDialogOpen(false);
            setReviewName("");
            setIsPageLoading(true);
            router.push(`/dashboard/bid-nobid/${review.scoringSessionId}`);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };
    useEffect(() => {
        setIsPageLoading(false);
    }, [router]);

    const handleDeleteReview = async (review: ScoringSession) => {
        setIsPageLoading(true);
        try {
            const res = await fetch(`/api/reviews`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: review.user_id, createdAt: review.createdAt }),
            });
            if (!res.ok) throw new Error('Failed to delete review');
            await fetchReviews();
        } catch (err) {
            console.error(err);
        } finally {
            setReviewToDelete(null);
            setIsPageLoading(false);
        }
    };

    // Only render null/loading here, after all hooks
    if (!isLoaded || !isSignedIn || !userId) {
        return null;
    }


    return (
        <>
            {isPageLoading && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
                </div>
            )}
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
                                            <h1 className="text-3xl font-bold text-[#112D4E]">Your Bids</h1>
                                            <p className="text-[#3F72AF] mt-1">
                                                {reviews?.length ? `${reviews.length} Bid${reviews.length !== 1 ? 's' : ''}` : 'No Bids yet'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            onClick={handleNewReview}
                                            className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32] shadow-lg hover:shadow-xl transition-all duration-200"
                                            size="lg"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Bid
                                        </Button>
                                    </div>
                                </div>
                            </div>
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
                                    <h3 className="text-xl font-semibold text-[#112D4E] mb-2">No Bids yet</h3>
                                    <p className="text-[#3F72AF] mb-6 text-center max-w-md">
                                        Create your first bid to start evaluating and scoring content or submissions.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            onClick={handleNewReview}
                                            className="bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32]"
                                            size="lg"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Your First Bid
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Reviews Grid */}
                            {!isLoading && reviews && reviews.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {reviews.map((review) => (
                                        <ReviewCard
                                            key={review.scoringSessionId}
                                            review={review}
                                            setIsPageLoading={setIsPageLoading}
                                            setReviewToDelete={setReviewToDelete}
                                            isAdmin={false}
                                        />
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
                                            Create New Bid
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
                                            Delete Bid?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-base text-[#3F72AF]">
                                            Are you sure you want to delete <span className="font-semibold text-[#112D4E]">"{reviewToDelete?.name}"</span>?
                                            This action cannot be undone and will permanently remove all scores, answers, and data associated with this Bid.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF]">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={async () => {
                                                setIsPageLoading(true);
                                                if (reviewToDelete) {
                                                    await handleDeleteReview(reviewToDelete);
                                                    await fetchReviews();
                                                }
                                                setIsPageLoading(false);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Bid
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