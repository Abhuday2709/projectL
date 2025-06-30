"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { ScoringSession } from "../../models/scoringReviewModel";
import { User as UserIcon, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";

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

// User Review Group Component
export function UserReviewGroup({ userGroup, setIsPageLoading }: { 
    userGroup: UserReviewGroup, 
    setIsPageLoading: (b: boolean) => void 
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();

    return (
        <Card className="border-2 border-[#DBE2EF] bg-white hover:border-[#3F72AF] transition-all duration-300">
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
            
            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {userGroup.reviews.map((review) => (
                            <Card
                                key={review.scoringSessionId}
                                className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-[#DBE2EF] hover:border-[#3F72AF] bg-[#F9F7F7] flex flex-col h-full"
                                onClick={() => {
                                    setIsPageLoading(true);
                                    router.push(`/dashboard/temp/${review.scoringSessionId}`);
                                }}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start gap-2">
                                        <ClipboardList className="h-4 w-4 text-[#3F72AF] mt-1 flex-shrink-0" />
                                        <div className="flex flex-col flex-1">
                                            <span className="truncate text-[#112D4E] font-semibold text-sm">
                                                {review.name}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
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
                                        {(review.scores?.length > 0 || review.answers?.length > 0) && (
                                            <div className="flex items-center gap-2 text-xs text-[#3F72AF]">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-medium">
                                                    {review.scores?.length || review.answers?.length} responses
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1" />
                                    <div className="flex gap-2 justify-end mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsPageLoading(true);
                                                router.push(`/dashboard/temp/${review.scoringSessionId}`);
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
