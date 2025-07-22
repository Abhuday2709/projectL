"use client";

import { useParams, useRouter } from "next/navigation";
import ChatWrapper from "@/components/chat/ChatWrapper";
import PdfRenderer from "@/components/PdfRenderer";
import { Button } from "@/components/ui/button";
import { Loader2, Clock } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Chat } from "@/models/chatModel";
import { Document } from "@/models/documentModel";
import { deleteFromS3 } from "@/lib/utils";
import ShareChatDialog from "@/components/ShareChatDialog";
import { DocumentWithStatus } from "@/lib/utils";

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [chatDetails, setChatDetails] = useState<Chat | null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatName, setChatName] = useState("Proposal");
    const chatIdStr = typeof chatId === "string" ? chatId : Array.isArray(chatId) ? chatId[0] ?? "" : "";

    const fetchChatDetails = async () => {
        if (!chatIdStr) return;
        setIsChatLoading(true);
        try {
            const res = await fetch(`/api/chat/${chatIdStr}`);
            if (!res.ok) throw new Error("Chat not found");
            const data = await res.json();
            setChatName(`Proposal ${data?.name}`);
            setChatDetails(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsChatLoading(false);
        }
    };

    const [documents, setDocuments] = useState<Document[]>([])
    const fetchDocuments = async (): Promise<Document[]> => {
        try {
            const res = await fetch(`/api/documents/getDocuments?chatId=${encodeURIComponent(chatIdStr)}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            setDocuments(data);
            return data;
        } catch (err: any) {
            return []; // Return empty on error
        }
    }

    const [isViewingDocument, setIsViewingDocument] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [documentsWithStatus, setDocumentsWithStatus] = useState<DocumentWithStatus[]>([]);
    const [isAnyDocumentProcessing, setIsAnyDocumentProcessing] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const podcastPollingRef = useRef<NodeJS.Timeout | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    useEffect(() => {
        if (chatIdStr) {
            fetchChatDetails();
            fetchDocuments();
        }
    }, [chatIdStr]);

    // Poll document status every 5s
    const fetchDocumentStatuses = async () => {
        try {
            const res = await fetch(`/api/documents/status?chatId=${encodeURIComponent(chatIdStr)}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            setDocumentsWithStatus(data);
            setIsAnyDocumentProcessing(
                data.some((doc: DocumentWithStatus) =>
                    ["QUEUED", "PROCESSING"].includes(doc.processingStatus || "")
                )
            );
        } catch {
            setDocumentsWithStatus([]);
            setIsAnyDocumentProcessing(false);
        }
    };

    useEffect(() => {
        fetchDocumentStatuses();
        pollingRef.current = setInterval(fetchDocumentStatuses, 5000);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [chatIdStr]);

    useEffect(() => {
        const shouldBeGenerating = chatDetails?.podcastProcessingStatus === 'QUEUED' || chatDetails?.podcastProcessingStatus === 'PROCESSING';
        setIsGenerating(shouldBeGenerating);
    }, [chatDetails?.podcastProcessingStatus]);

    // The podcast polling effect remains the same but will now work correctly:
    useEffect(() => {
        if (isGenerating) {
            // Clear any existing interval first
            if (podcastPollingRef.current) {
                clearInterval(podcastPollingRef.current);
            }

            // Start polling immediately
            const pollForUpdates = () => {
                fetchChatDetails();
            };

            // Poll every 3 seconds while generating (more frequent for better UX)
            podcastPollingRef.current = setInterval(pollForUpdates, 3000);
        } else {
            // Clear polling when not generating
            if (podcastPollingRef.current) {
                clearInterval(podcastPollingRef.current);
                podcastPollingRef.current = null;
            }
        }

        return () => {
            if (podcastPollingRef.current) {
                clearInterval(podcastPollingRef.current);
                podcastPollingRef.current = null;
            }
        };
    }, [isGenerating]);


    useEffect(() => {
        if (chatDetails?.podcastFinal && chatDetails.podcastProcessingStatus === 'COMPLETED') {
            setPodcastUrl(chatDetails.podcastFinal);
        }
    }, [chatDetails?.podcastFinal, chatDetails?.podcastProcessingStatus]);

    const handleGeneratePodcast = async () => {
        // Optimistically update the UI to show the loading state immediately
        // setChatDetails(prev => prev ? { ...prev, podcastProcessingStatus: 'QUEUED' } : null);                              
        setIsGenerating(true);
        if (podcastUrl) {
            const urlParts = podcastUrl.split('/');
            const s3Key = urlParts.slice(3).join('/');
            deleteFromS3(s3Key);
        }

        try {
            const latestDocuments = await fetchDocuments();
            if (!latestDocuments || latestDocuments.length === 0) {
                toast({
                    title: "No Documents Found",
                    description: "Please upload a document to generate a podcast.",
                    variant: "destructive",
                });
                // Revert optimistic update
                setChatDetails(prev => prev ? { ...prev, podcastProcessingStatus: "IDLE" } : null);
                return;
            }

            const documentIds = latestDocuments.map((doc) => doc.docId);
            const result = await fetch('/api/podcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    DocIdList: documentIds,
                    chatId: chatIdStr,
                    user_id: chatDetails?.user_id,
                    createdAt: chatDetails?.createdAt,
                    duration: 5
                }),
            });

            if (!result.ok) {
                toast({
                    title: "Failed to start podcast generation.",
                    variant: "destructive",
                });
                // Revert optimistic update on error
                setChatDetails(prev => prev ? { ...prev, podcastProcessingStatus: 'FAILED' } : null);
                throw new Error("Failed to start podcast generation.");
            } else {
                toast({
                    title: "Podcast generation started",
                    description: `Your podcast is being generated. Till then chat with the documents`,
                    variant: "default",
                });
                // Fetch immediately to get the actual status from backend
                setTimeout(() => {
                    fetchChatDetails();
                }, 500); // Small delay to ensure backend has processed the request
            }
        } catch (err: any) {
            console.error("Error generating podcast:", err);
            // On error, revert to a failed state or clear the status
            setChatDetails(prev => prev ? { ...prev, podcastProcessingStatus: 'FAILED' } : null);
        }
    };

    const getButtonText = () => {
        switch (chatDetails?.podcastProcessingStatus) {
            case 'QUEUED':
            case 'PROCESSING':
                return 'Generating...';
            case 'COMPLETED':
                return 'Regenerate';
            case 'FAILED':
                return 'Retry Generation';
            default:
                return 'Generate Podcast';
        }
    };

    // Update podcast button logic to use documentsWithStatus and isAnyDocumentProcessing
    const canGeneratePodcast =
        !isGenerating &&
        documentsWithStatus.some(doc => doc.processingStatus === "COMPLETED") &&
        !isAnyDocumentProcessing;

    return (
        <div className="flex bg-gray-50 min-h-[170vh] lg:min-h-0">
            <Sidebar />
            <div className="flex flex-col flex-1 lg:ml-64 w-full">
                {/* Header */}
                <div className="flex sm:flex items-start sm:items-center justify-between py-3 sm:py-4 px-3 sm:px-4 flex-shrink-0 bg-white border-b border-gray-200 gap-3 sm:gap-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {isChatLoading ? (
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-600" />
                        ) : (
                            <h1 className="text-base sm:text-xl font-semibold truncate bg-gray-100 text-gray-900 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 max-w-full">
                                {chatName}
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <ShareChatDialog chatId={chatIdStr} />
                        <Button
                            variant="outline"
                            onClick={() => router.push('/dashboard/sendProposals')}
                            className="border-gray-300 text-gray-700 hover:bg-gray-100 text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none rounded-md"
                        >
                            Close
                        </Button>
                    </div>
                </div>

                {/* Main Content - Responsive Panel Layout */}
                <div className="flex-1 overflow-hidden">
                    {/* Desktop Layout - Horizontal Panels */}
                    <div className="hidden lg:block h-[calc(100vh-9.5rem)]">
                        <PanelGroup direction="horizontal" className="flex-1 h-full">
                            <Panel defaultSize={55} minSize={48}>
                                <div className=" flex flex-col gap-4 p-2 h-full overflow-y-auto">
                                    <div className={`flex flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm p-4 no-scrollbar`}>
                                        <div className="flex-1">
                                            <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                        </div>
                                    </div>
                                    {!isViewingDocument && (
                                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <h3 className="flex items-center text-base font-semibold text-gray-800">
                                                        <Clock className="h-5 w-5 mr-2 text-[#3F72AF]" />
                                                        Podcast Summary
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Listen to an AI-generated podcast summary of your documents
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <Button
                                                    onClick={handleGeneratePodcast}
                                                    disabled={!canGeneratePodcast}
                                                    className="flex-1 h-10 text-sm px-4 py-2 bg-[#3F72AF] hover:bg-[#112D4E] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="h-4 w-4 mr-2" />
                                                            {getButtonText()}
                                                        </>
                                                    )}
                                                </Button>
                                                {podcastUrl && !isGenerating && (
                                                    <div className="flex-1">
                                                        <audio
                                                            controls
                                                            className="w-full h-10 rounded-md"
                                                            style={{ height: '40px' }}
                                                        >
                                                            <source src={podcastUrl} type="audio/mpeg" />
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Panel>
                            <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors flex items-center justify-center">
                                <div className="w-1 h-8 bg-blue-500 rounded-full" />
                            </PanelResizeHandle>
                            <Panel defaultSize={45} minSize={45}>
                                <div className="p-4 flex flex-col">
                                    <ChatWrapper chatId={chatIdStr} />
                                </div>
                            </Panel>
                        </PanelGroup>
                    </div>

                    {/* Mobile/Tablet Layout - Vertical Panels */}
                    <div className="lg:hidden h-full">
                        <PanelGroup direction="vertical" className="flex-1 overflow-hidden h-full">
                            <Panel defaultSize={50} minSize={45}>
                                <div className="h-full flex flex-col gap-4 p-3 sm:p-4">
                                    <div className={`flex flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm p-3 sm:p-4 ${isViewingDocument ? "flex-1" : "h-1/2"}`}>
                                        <div className="flex-1">
                                            <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                        </div>
                                    </div>
                                    {!isViewingDocument && (
                                        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex flex-col flex-1">
                                                    <h3 className="flex items-center text-sm font-semibold text-gray-800">
                                                        <Clock className="h-4 w-4 mr-2 text-[#3F72AF]" />
                                                        Podcast Summary
                                                    </h3>
                                                    <p className="text-xs text-gray-600 mt-1">
                                                        Listen to an AI summary of your documents
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col space-y-2">
                                                <Button
                                                    onClick={handleGeneratePodcast}
                                                    disabled={isGenerating || documents.length === 0}
                                                    className="w-full h-8 text-xs px-3 py-1 bg-[#3F72AF] hover:bg-[#112D4E] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {getButtonText()}
                                                        </>
                                                    )}
                                                </Button>
                                                {podcastUrl && !isGenerating && (
                                                    <audio
                                                        controls
                                                        className="w-full h-8 rounded-md"
                                                        style={{ height: '32px' }}
                                                    >
                                                        <source src={podcastUrl} type="audio/mpeg" />
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Panel>
                            <PanelResizeHandle className="h-1 bg-gray-200 hover:bg-blue-500 transition-colors flex items-center justify-center">
                                <div className="w-8 h-1 bg-blue-500 rounded-full" />
                            </PanelResizeHandle>
                            <Panel defaultSize={50} minSize={50}>
                                <div className="h-full p-3 sm:p-4 flex flex-col">
                                    <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                        <ChatWrapper chatId={chatIdStr} />
                                    </div>
                                </div>
                            </Panel>
                        </PanelGroup>
                    </div>
                </div>
            </div>
        </div>
    );
}