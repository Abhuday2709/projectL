"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ScoringSession } from "@/models/scoringReviewModel";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Sidebar from "@/components/Sidebar";
import EditQuestionsAndCategories from "@/components/EditQuestionsAnd Categories";
import { QuestionType } from "@/lib/utils";
import { Settings, Loader2, Users, User as UserIcon, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UserReviewGroup } from "@/components/AdminReviewCard";
import { BarChart3 } from "lucide-react";
import AdminScoresGraph from "@/components/AdminScoresGraph";
import { Category } from "@/models/categoryModel";

interface User {
    user_id: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

interface ReviewWithUser extends ScoringSession {
    userEmail?: string;
    userName?: string;
}

interface UserReviewGroup {
    user: User;
    reviews: ReviewWithUser[];
    displayName: string;
}
export default function AdminDashboardReviewPage() {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    // All hooks must be called unconditionally
    const [showEditModal, setShowEditModal] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [questions, setQuestions] = useState<QuestionType[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [question, setQuestion] = useState<QuestionType[]>([]);
    const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [userReviewGroups, setUserReviewGroups] = useState<UserReviewGroup[]>([]);
    const [showScoresGraph, setShowScoresGraph] = useState(false);

    const fetchQuestions = async () => {
        const res = await fetch(`/api/evaluation-questions`, {
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

    const fetchAllUsers = async () => {
        try {
            const res = await fetch('/api/admin/getAllUsers');
            if (!res.ok) throw new Error('Failed to fetch users');
            const data: User[] = await res.json();
            // console.log("Fetched Users:", data);

            setUsers(data);
            return data;
        } catch (err) {
            toast({ title: 'Error fetching users', description: (err as Error).message, variant: 'destructive' });
            return [];
        }
    };

    const fetchAllReviews = async () => {
        setIsLoading(true);
        try {
            // First fetch all users
            const userData = await fetchAllUsers();

            // Then fetch all reviews
            const res = await fetch('/api/admin/getAllReview');
            if (!res.ok) throw new Error('Failed to fetch all reviews');
            const data: ScoringSession[] = await res.json();

            // Enhance reviews with user information
            const reviewsWithUserInfo: ReviewWithUser[] = data.map(review => {
                const user = userData.find(u => u.user_id === review.user_id);
                return {
                    ...review,
                    userEmail: user?.email,
                    userName: user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.firstName || user?.lastName || 'Unknown User'
                };
            });
            // console.log("Fetched Reviews with User Info:", reviewsWithUserInfo);

            setReviews(reviewsWithUserInfo);

            // Group reviews by user
            const grouped = userData.reduce<UserReviewGroup[]>((acc, user) => {
                const userReviews = reviewsWithUserInfo.filter(review => review.user_id === user.user_id);
                // console.log(`User ${user.email} has ${userReviews.length} reviews`);

                if (userReviews.length >= 0) {
                    const displayName = user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.firstName || user.lastName || user.email || 'Unknown User';

                    acc.push({
                        user,
                        reviews: userReviews,
                        displayName
                    });
                }
                return acc;
            }, []);
            // Sort by number of reviews (descending) then by display name
            grouped.sort((a, b) => {
                if (a.reviews.length !== b.reviews.length) {
                    return b.reviews.length - a.reviews.length;
                }
                return a.displayName.localeCompare(b.displayName);
            });
            // console.log("Grouped User Reviews:", grouped);


            setUserReviewGroups(grouped);
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
            fetchAllReviews()
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

    useEffect(() => {
        setIsPageLoading(false);
    }, [router]);

    // Only render null/loading here, after all hooks
    if (!isLoaded || !isSignedIn || !userId) {
        return null;
    }

    const totalReviews = reviews.length;
    const totalUsers = userReviewGroups.length;

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
                                            <Users className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-bold text-[#112D4E]">All User Reviews</h1>
                                            <p className="text-[#3F72AF] mt-1">
                                                {totalUsers > 0 ? `${totalUsers} user${totalUsers !== 1 ? 's' : ''} with ${totalReviews} total review session${totalReviews !== 1 ? 's' : ''}` : 'No review sessions found'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowScoresGraph(true)}
                                            className="hover:bg-[#DBE2EF] border-[#3F72AF] text-[#3F72AF]"
                                            disabled={reviews.length === 0}
                                        >
                                            <BarChart3 className="h-4 w-4 mr-2" />
                                            View All Scores
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowEditModal(true)}
                                            className="hover:bg-[#DBE2EF] border-[#3F72AF] text-[#3F72AF]"
                                        >
                                            <Settings className="h-4 w-4 mr-2" />
                                            Edit Questions
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
                                            await Promise.all([fetchCategories(), fetchQuestions()]);
                                        }}
                                    />
                                </DialogContent>
                            </Dialog>
                            <AdminScoresGraph
                                reviews={reviews}
                                isOpen={showScoresGraph}
                                onClose={() => setShowScoresGraph(false)}
                            />
                            {/* Loading State */}
                            {isLoading && (
                                <div className="space-y-6">
                                    {[...Array(3)].map((_, i) => (
                                        <Card key={i} className="animate-pulse bg-white border-[#DBE2EF]">
                                            <CardHeader>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-[#DBE2EF] rounded-lg"></div>
                                                    <div className="space-y-2">
                                                        <div className="h-5 bg-[#DBE2EF] rounded w-32"></div>
                                                        <div className="h-4 bg-[#DBE2EF] rounded w-24"></div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && userReviewGroups.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                    <div className="p-4 bg-gradient-to-r from-[#DBE2EF] to-[#F9F7F7] rounded-full mb-6">
                                        <Users className="h-12 w-12 text-[#3F72AF]" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-[#112D4E] mb-2">No review sessions found</h3>
                                    <p className="text-[#3F72AF] mb-6 text-center max-w-md">
                                        There are no review sessions from any users in the system yet.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowEditModal(true)}
                                            className="hover:bg-[#DBE2EF] border-[#3F72AF] text-[#3F72AF]"
                                        >
                                            <Settings className="h-4 w-4 mr-2" />
                                            Setup Questions
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* User Review Groups */}
                            {!isLoading && userReviewGroups.length >= 0 && (
                                <div className="space-y-6">
                                    {userReviewGroups.map((userGroup) => (
                                        <UserReviewGroup
                                            key={userGroup.user.user_id}
                                            userGroup={userGroup}
                                            setIsPageLoading={setIsPageLoading}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </MaxWidthWrapper>
                </div>
            </div>
        </>
    );
}