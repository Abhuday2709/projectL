"use client";

import { useParams, useRouter } from "next/navigation";
import ChatWrapper from "@/components/chat/ChatWrapper";
import PdfRenderer from "@/components/PdfRenderer";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import bcrypt from "bcryptjs";
import { Chat } from "@/models/chatModel";
import { Document } from "@/models/documentModel";
import { deleteFromS3 } from "@/lib/utils";

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();
    const { toast } = useToast(); // Ensure useToast is called inside the component
    const [chatDetails, setChatDetails] = useState<Chat | null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatName, setChatName] = useState("Chat");
    const chatIdStr = typeof chatId === "string" ? chatId : Array.isArray(chatId) ? chatId[0] ?? "" : "";
    const fetchChatDetails = async () => {
        if (!chatIdStr) return;
        setIsChatLoading(true);
        try {
            const res = await fetch(`/api/chat/${chatIdStr}`);
            if (!res.ok) throw new Error("Chat not found");
            const data = await res.json();
            setChatDetails(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsChatLoading(false);
        }
    };
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const fetchDocuments = async (): Promise<Document[]> => {
        setLoading(true)
        try {
            const res = await fetch(`/api/documents/getDocuments?chatId=${encodeURIComponent(chatIdStr)}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json();
            setDocuments(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return []; // Return empty on error
        } finally {
            setLoading(false);
        }
    }
    const [error, setError] = useState<string | null>(null);
    const [isViewingDocument, setIsViewingDocument] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [sharePassword, setSharePassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareSessionData, setShareSessionData] = useState<{
        shareId: string;
        chatId: string;
        password: string;
        isActive: boolean;
    } | null>(null);
    const updateShareSession = async (payload: { chatId: string; password: string; isActive: boolean }) => {
        try {
            const res = await fetch("/api/shareSession/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to update shareSession");
            const data = await res.json();
            toast({
                title: "Share settings updated!",
                description: "Your share settings have been updated successfully.",
            });
            setShareSessionData((prev) => ({
                shareId: prev?.shareId ?? "",
                chatId: payload.chatId,
                password: payload.password,
                isActive: payload.isActive,
            }));
        } catch (error: any) {
            toast({
                title: "Error updating share settings",
                description: error.message,
                variant: "destructive",
            });
        }
    };
    const fetchShareSession = async () => {
        if (!chatIdStr) return;
        try {
            const res = await fetch(`/api/shareSession/byChatId?chatId=${chatIdStr}`);
            if (!res.ok) throw new Error('Share session not found');
            const data = await res.json();
            setShareSessionData(data);
        } catch (err) {
            console.error("Failed to fetch shareSessionData", err);
        }
    };
    useEffect(() => {
        if (chatIdStr) {
            fetchChatDetails();
            fetchShareSession();
            fetchDocuments();
        }
    }, [chatIdStr]);

    // Derived state for podcast generation
    const isGenerating = chatDetails?.podcastProcessingStatus === 'QUEUED' || chatDetails?.podcastProcessingStatus === 'PROCESSING';

    // Add this useEffect to poll for updates while generating
    useEffect(() => {
        let pollInterval: NodeJS.Timeout | null = null;

        if (isGenerating) {
            // Poll every 5 seconds while generating
            pollInterval = setInterval(() => {
                fetchChatDetails();
            }, 5000);
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [isGenerating, chatIdStr]);

    useEffect(() => {
        if (chatDetails?.podcastFinal && chatDetails.podcastProcessingStatus === 'COMPLETED') {
            setPodcastUrl(chatDetails.podcastFinal);
        }
    }, [chatDetails?.podcastFinal, chatDetails?.podcastProcessingStatus]);

    const handleGeneratePodcast = async () => {
        setError(null);

        // Optimistically update the UI to show the loading state immediately
        setChatDetails(prev => prev ? { ...prev, podcastProcessingStatus: 'QUEUED' } : null);

        if (podcastUrl) {
            const urlParts = podcastUrl.split('/');
            console.log("urlParts", urlParts);
            const s3Key = urlParts.slice(3).join('/'); // Remove 'https://bucket.s3.region.amazonaws.com/'
            deleteFromS3(s3Key)
        }
        try {
            const latestDocuments = await fetchDocuments();
            if (!latestDocuments || latestDocuments.length === 0) {
                toast({
                    title: "No Documents Found",
                    description: "Please upload a document to generate a podcast.",
                    variant: "destructive",
                });
                fetchChatDetails(); // Revert optimistic update
                return;
            }

            const documentIds = latestDocuments.map((doc) => doc.docId);
            const result = await fetch('/api/podcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ DocIdList: documentIds, chatId: chatIdStr, user_id: chatDetails?.user_id, createdAt: chatDetails?.createdAt }),
            });
            if (!result.ok) {
                toast({
                    title: "Failed to start podcast generation.",
                    variant: "destructive",
                });
                throw new Error("Failed to start podcast generation.");
            } else {
                toast({
                    title: "Podcast generation started",
                    description: "Your podcast is being generated. You will be notified when it's ready.",
                    variant: "default",
                });
                // The optimistic update is now confirmed by the backend.
                // A final fetch ensures we have the latest DB state for polling.
                fetchChatDetails();
            }
        } catch (err: any) {
            // Revert the optimistic update if any error occurs
            fetchChatDetails();
        }
    };
    const handleUpdatePassword = async () => {
        if (!sharePassword.trim()) {
            toast({
                title: "Password required",
                description: "Please enter a new password.",
                variant: "destructive",
            });
            return;
        }
        const hashedPassword = await bcrypt.hash(sharePassword.trim(), 10);
        console.log("hashedPassword", hashedPassword);

        await updateShareSession({
            chatId: chatIdStr,
            password: hashedPassword,
            isActive: shareSessionData?.isActive ?? true,
        });
        setIsChangingPassword(false);
        setSharePassword("");
    };
    const handleToggleActive = async () => {
        const newActiveState = !shareSessionData?.isActive;

        await updateShareSession({
            chatId: chatIdStr,
            password: shareSessionData?.password || "",
            isActive: newActiveState,
        });
    };
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({
                title: "Copied to clipboard!",
                description: "Share link has been copied to your clipboard.",
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast({
                title: "Failed to copy",
                description: "Please copy the link manually.",
                variant: "destructive",
            });
        }
    };

    const shareUrl = `${process.env.NEXT_PUBLIC_WEBSITE_URL}/s/${shareSessionData?.shareId}`;

    const getButtonText = () => {
        switch (chatDetails?.podcastProcessingStatus) {
            case 'QUEUED':
            case 'PROCESSING':
                return 'Generating...';
            case 'COMPLETED':
                return 'Regenerate Podcast';
            case 'FAILED':
                return 'Retry Generation';
            default:
                return 'Generate Podcast';
        }
    };
    return (
    <div className="flex bg-gray-50 min-h-[170vh] lg:min-h-0">
        <Sidebar />
        <div className="flex flex-col flex-1 lg:ml-64 w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 sm:py-4 px-3 sm:px-4 flex-shrink-0 bg-white border-b border-gray-200 gap-3 sm:gap-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {isChatLoading ? (
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-600" />
                    ) : (
                        <h1 className="text-base sm:text-xl font-semibold truncate bg-gray-100 text-gray-900 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 max-w-full">
                            {chatName}
                        </h1>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                        onClick={() => setShowShareDialog(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-none text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none rounded-md"
                    >
                        <span className="hidden sm:inline">
                            {shareSessionData?.password && shareSessionData?.isActive ? "Manage Share" : "Share Chat"}
                        </span>
                        <span className="sm:hidden">
                            {shareSessionData?.password && shareSessionData?.isActive ? "Manage" : "Share"}
                        </span>
                    </Button>
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
                    <PanelGroup direction="horizontal" className="flex-1 overflow-scroll h-full">
                        <Panel defaultSize={55} minSize={42}>
                            <div className="h-full flex flex-col gap-4 p-4">
                                <div className={`flex flex-col overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm p-4 ${isViewingDocument ? "h-[95%]" : "min-h-[60%]"}`}>
                                    <div className="flex-1 h-full">
                                        <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                    </div>
                                </div>
                                {!isViewingDocument && (
                                    <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm p-4 overflow-y-auto">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-lg font-semibold text-gray-900">Generate Podcast</h2>
                                            <Button
                                                onClick={handleGeneratePodcast}
                                                disabled={isGenerating || (documents?.length || 0) === 0}
                                                className="w-44 bg-blue-600 hover:bg-blue-700 text-white border-none disabled:bg-gray-300 disabled:text-gray-500 rounded-md"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    getButtonText()
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">
                                            {isGenerating 
                                                ? "Generating your podcast, this may take a few minutes. Feel free to chat with the documents in the meantime."
                                                : "Listen to an audio podcast summary of the uploaded documents."
                                            }
                                        </p>
                                        {podcastUrl && !isGenerating && (
                                            <div className="space-y-2">
                                                <audio controls className="w-full">
                                                    <source src={podcastUrl} />
                                                    Your browser does not support the audio element.
                                                </audio>
                                            </div>
                                        )}
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
                                    <div className="flex-1 flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm p-3 sm:p-4 min-h-[120px]">
                                        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Generate Podcast</h2>
                                        <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                                            Generate an audio podcast summary of the uploaded documents.
                                        </p>
                                        <Button
                                            onClick={handleGeneratePodcast}
                                            disabled={isGenerating || (documents?.length || 0) === 0}
                                            className="mb-2 w-full sm:w-44 bg-blue-600 hover:bg-blue-700 text-white border-none disabled:bg-gray-300 disabled:text-gray-500 text-xs sm:text-sm rounded-md"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-2" />
                                                    Generating...
                                                </>
                                            ) : (
                                                getButtonText()
                                            )}
                                        </Button>
                                        <p className="text-xs sm:text-sm text-gray-600">
                                            {isGenerating
                                                ? "Generating your podcast, till then chat with the documents."
                                                : "Generate an audio podcast summary of the uploaded documents."
                                            }
                                        </p>
                                        {podcastUrl && !isGenerating && (
                                            <div className="space-y-2 mt-2">
                                                <h3 className="font-semibold text-sm sm:text-base text-gray-900">Podcast Audio</h3>
                                                <audio controls className="w-full h-8">
                                                    <source src={podcastUrl} />
                                                    Your browser does not support the audio element.
                                                </audio>
                                            </div>
                                        )}
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
        
        {/* Share Dialog */}
        {showShareDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112D4E] bg-opacity-60 p-4">
                    <div className="bg-[#F9F7F7] rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-sm sm:max-w-2xl border-2 border-[#DBE2EF] max-h-[90vh] overflow-y-auto">
                        {!shareSessionData?.password ? (
                            // Create new share session
                            <>
                                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[#112D4E]">Create Share Link</h2>
                                <p className="text-xs sm:text-sm text-[#3F72AF] mb-3 sm:mb-4">
                                    Set a password to allow others to access this chat.
                                </p>
                                <input
                                    type="password"
                                    className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 mb-3 sm:mb-4 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-[#112D4E] text-sm sm:text-base"
                                    placeholder="Enter password"
                                    value={sharePassword}
                                    onChange={(e) => setSharePassword(e.target.value)}
                                />
                                <div className="flex flex-col sm:flex-row justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setShowShareDialog(false);
                                            setSharePassword("");
                                        }}
                                        className="bg-[#DBE2EF] hover:bg-[#3F72AF] text-[#112D4E] hover:text-white border-none text-sm order-2 sm:order-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUpdatePassword}
                                        disabled={!sharePassword.trim()}
                                        className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-[#DBE2EF] disabled:text-[#3F72AF] text-sm order-1 sm:order-2"
                                    >
                                        Create
                                    </Button>
                                </div>
                            </>
                        ) : (
                            // Manage existing share session
                            <>
                                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[#112D4E]">Manage Share Link</h2>

                                {/* Share URL */}
                                <div className="mb-3 sm:mb-4">
                                    <label className="block text-xs sm:text-sm font-medium text-[#112D4E] mb-2">
                                        Share URL
                                    </label>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1 font-mono text-xs sm:text-sm bg-[#DBE2EF] text-[#112D4E] p-2 rounded-lg border border-[#3F72AF]/20 break-all overflow-hidden">
                                            {shareUrl}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(shareUrl)}
                                            className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white flex-shrink-0"
                                        >
                                            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="mb-3 sm:mb-4">
                                    <label className="block text-xs sm:text-sm font-medium text-[#112D4E] mb-2">
                                        Password
                                    </label>
                                    {isChangingPassword ? (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-[#112D4E] text-sm sm:text-base"
                                                placeholder="Enter new password"
                                                value={sharePassword}
                                                onChange={(e) => setSharePassword(e.target.value)}
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleUpdatePassword}
                                                    disabled={!sharePassword.trim()}
                                                    className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-[#DBE2EF] disabled:text-[#3F72AF] text-xs order-1"
                                                >
                                                    Update
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsChangingPassword(false);
                                                        setSharePassword("");
                                                    }}
                                                    className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white text-xs order-2"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <div className="flex-1 font-mono text-xs sm:text-sm bg-[#DBE2EF] text-[#112D4E] p-2 rounded-lg border border-[#3F72AF]/20">
                                                {"•".repeat(shareSessionData.password?.length || 0)}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsChangingPassword(true)}
                                                className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white flex-shrink-0"
                                            >
                                                Change
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Active Toggle */}
                                <div className="mb-4 sm:mb-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex-1">
                                            <label className="block text-xs sm:text-sm font-medium text-[#112D4E]">
                                                Share Status
                                            </label>
                                            <p className="text-xs text-[#3F72AF]">
                                                {shareSessionData.isActive
                                                    ? "Share link is active and accessible"
                                                    : "Share link is disabled"
                                                }
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-start sm:justify-end">
                                            <input
                                                type="checkbox"
                                                id="isActive"
                                                checked={shareSessionData.isActive ?? false}
                                                onChange={handleToggleActive}
                                                className="mr-2 accent-[#3F72AF] scale-110"
                                            />
                                            <label htmlFor="isActive" className="text-xs sm:text-sm text-[#112D4E]">
                                                Active
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end">
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setShowShareDialog(false);
                                            setIsChangingPassword(false);
                                            setSharePassword("");
                                        }}
                                        className="bg-[#DBE2EF] hover:bg-[#3F72AF] text-[#112D4E] hover:text-white border-none text-sm w-full sm:w-auto"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
    </div>
);
}