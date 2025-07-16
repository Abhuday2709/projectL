"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { ScoringSession } from "@/models/scoringReviewModel";
import { User as UserIcon, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";

/**
 * Represents a user in the system.
 * @property {string} user_id - Unique identifier for the user.
 * @property {string} email - User's email address.
 * @property {string} [firstName] - User's first name (optional).
 * @property {string} [lastName] - User's last name (optional).
 */
interface User {
    user_id: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Extends ScoringSession with optional user metadata.
 * @extends ScoringSession
 * @property {string} [userEmail] - Email of the user who created the session.
 * @property {string} [userName]  - Display name of the user.
 */
interface ReviewWithUser extends ScoringSession {
    userEmail?: string;
    userName?: string;
}

/**
 * Groups multiple reviews under a single user.
 * @property {User} user - The user who performed these reviews.
 * @property {ReviewWithUser[]} reviews - Array of reviews by this user.
 * @property {string} displayName - Name to display in the UI for this group.
 */
interface UserReviewGroup {
    user: User;
    reviews: ReviewWithUser[];
    displayName: string;
}

/**
 * Renders a collapsible card grouping review sessions by user.
 * @param {object} props.userGroup - Data for the user and their reviews.
 * @param {(b: boolean) => void} props.setIsPageLoading - Callback to toggle a loading state.
 * @returns JSX.Element - A Card that expands to show individual review cards.
 * @usage
 * <UserReviewGroup userGroup={groupData} setIsPageLoading={setLoading} />
 */
export function UserReviewGroup({
    userGroup,
    setIsPageLoading
}: {
    userGroup: UserReviewGroup;
    setIsPageLoading: (b: boolean) => void;
}) {
    // Local state: whether the review list is expanded
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    return (
        <Card className="border-2 border-[#DBE2EF] bg-white hover:border-[#3F72AF] transition-all duration-300">
            {/* Header toggles expansion */}
            <CardHeader
                className="cursor-pointer hover:bg-[#F9F7F7] transition-colors duration-200"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg">
                            <UserIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[#112D4E]">
                                {userGroup.displayName}
                            </h3>
                            <p className="text-sm text-[#3F72AF]">
                                {userGroup.reviews.length} review session{userGroup.reviews.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-sm text-[#3F72AF] font-medium">
                            {userGroup.reviews.length} reviews
                        </div>
                        {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-[#3F72AF]" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-[#3F72AF]" />
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* Conditionally render review cards when expanded */}
            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {userGroup.reviews.map((review) => (
                            <Card
                                key={review.scoringSessionId}
                                className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-[#DBE2EF] hover:border-[#3F72AF] bg-[#F9F7F7] flex flex-col h-full"
                                onClick={() => {
                                    setIsPageLoading(true);
                                    router.push(`/dashboard/bid-nobid/${review.scoringSessionId}`);
                                }}
                            >
                                {/* Review session header */}
                                <CardHeader className="pb-3">
                                    <div className="flex items-start gap-2">
                                        <ClipboardList className="h-4 w-4 text-[#3F72AF] mt-1 flex-shrink-0" />
                                        <div className="flex flex-col flex-1">
                                            <span className="overflow-hidden text-[#112D4E] font-semibold text-sm">
                                                {review.name}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                {/* Review session metadata */}
                                <CardContent className="pt-0 flex flex-col flex-1">
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-xs text-[#3F72AF]">
                                            <div className="w-2 h-2 bg-[#3F72AF] rounded-full"></div>
                                            <span>
                                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </span>
                                        </div>
                                        {/*Show number of responses if available.*/}
                                        {(review.scores?.length > 0 || review.answers?.length > 0) && (
                                            <div className="flex items-center gap-2 text-xs text-[#3F72AF]">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-medium">
                                                    {review.answers?.length} responses
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1" />
                                    {/* Action button to view review */}
                                    <div className="flex gap-2 justify-end mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsPageLoading(true);
                                                router.push(`/dashboard/bid-nobid/${review.scoringSessionId}`);
                                            }}
                                        >
                                            View Review
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
