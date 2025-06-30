import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowRight, Calendar, Trash2 } from "lucide-react";
import { ScoringSession } from "../../models/scoringReviewModel";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Document } from "../../models/documentModel";

export function ReviewCard({ review, setIsPageLoading, setReviewToDelete }: {
    review: ScoringSession,
    setIsPageLoading: (b: boolean) => void,
    setReviewToDelete: (r: ScoringSession) => void
}) {
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!review.scoringSessionId) return;
        setLoading(true);
        fetch(`/api/documents/status?chatId=${encodeURIComponent(review.scoringSessionId)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`Error ${res.status}`);
                return res.json();
            })
            .then((data) => setDocuments(data))
            .catch((err) => setError(err))
            .finally(() => setLoading(false));
    }, [review.scoringSessionId]);

    const isAnyProcessing = documents.some(
        (doc) => doc.processingStatus === "QUEUED" || doc.processingStatus === "PROCESSING"
    );

    return (
        <Card
            key={review.scoringSessionId}
            className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 bg-white border-[#DBE2EF] hover:border-[#3F72AF]"
            onClick={() => {
                setIsPageLoading(true);
                router.push(`/dashboard/temp/${review.scoringSessionId}`);
            }}
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
                                    year: 'numeric',
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
                    {isAnyProcessing && (
                        <div className="text-xs text-[#3F72AF] mt-2">
                            Document is being processed. Delete disabled.
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-[#DBE2EF] hover:bg-[#3F72AF] border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] hover:text-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPageLoading(true);
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
                            disabled={isAnyProcessing}
                            title={isAnyProcessing ? "Cannot delete while a document is processing" : ""}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
