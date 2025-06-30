"use client";

import { useParams, useRouter } from "next/navigation";
import ChatWrapper from "@/components/chat/ChatWrapper";
import PdfRenderer from "@/components/PdfRenderer";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "@/components/Sidebar";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import bcrypt from "bcryptjs";
import { Chat } from "../../../../../models/chatModel";
import { Document } from "../../../../../models/documentModel";
import { deleteFromS3 } from "@/lib/utils";

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();
    const { toast } = useToast(); // Ensure useToast is called inside the component
 const [chatDetails, setChatDetails] = useState<Chat | null>(null);
     const [isChatLoading, setIsChatLoading] = useState(false);
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
    const fetchDocuments = () => {
        setLoading(true)
        fetch(`/api/documents/getDocuments?chatId=${encodeURIComponent(chatIdStr)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`Error ${res.status}`)
                return res.json()
            })
            .then((data) => setDocuments(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }
    const deleteFileMutation = trpc.aws.deleteFile.useMutation();
    const [isGenerating, setIsGenerating] = useState(false);
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
        if (chatDetails?.podcastFinal) {
            setIsGenerating(false);
            setPodcastUrl(chatDetails.podcastFinal);
        }
    }, [chatDetails?.podcastFinal]);
    const handleGeneratePodcast = async () => {
        setIsGenerating(true);
        setError(null);
        if (podcastUrl) {
                const urlParts = podcastUrl.split('/');
                console.log("urlParts", urlParts);
                const s3Key = urlParts.slice(3).join('/'); // Remove 'https://bucket.s3.region.amazonaws.com/'
                //deleteFileMutation.mutate({ key: s3Key });
                deleteFromS3(s3Key)
            }
        try {
            await fetchDocuments();
            const latestDocuments = documents; // Get the last 3 documents
            if (!latestDocuments || latestDocuments.length === 0) {
                toast({
                    title: "No Documents Found",
                    description: "Please upload a document to generate a podcast.",
                    variant: "destructive",
                });
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
                    title: "Failed to generate podcast. Please try again.",
                    variant: "destructive",
                });
                throw new Error("Failed to generate podcast. Please try again.");
            } else {
                toast({
                    title: "Podcast generation started",
                    description: "Your podcast is being generated. You will be notified when it's ready.",
                    variant: "default",
                });
            }
        } catch (err: any) {
            // handle error
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

    return (
        <div className="flex bg-[#F9F7F7] min-h-[170vh] lg:min-h-0">
            <Sidebar />
            <div className="flex flex-col flex-1 lg:ml-64 w-full">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 sm:py-4 px-3 sm:px-4 flex-shrink-0 bg-[#F9F7F7] border-b border-[#3F72AF]/20 gap-3 sm:gap-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {isChatLoading ? (
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-[#3F72AF]" />
                        ) : (
                            <h1 className="text-base sm:text-xl font-semibold truncate bg-[#DBE2EF] text-[#112D4E] px-3 sm:px-4 py-2 rounded-lg shadow-sm border border-[#DBE2EF] max-w-full">
                                {chatDetails?.name || "Chat"}
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            onClick={() => setShowShareDialog(true)}
                            className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none"
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
                            className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF] text-xs sm:text-sm px-3 sm:px-4 flex-1 sm:flex-none"
                        >
                            Close
                        </Button>
                    </div>
                </div>

                {/* Main Content - Responsive Panel Layout */}
                <div className="flex-1 overflow-hidden">
                    {/* Desktop Layout - Horizontal Panels */}
                    <div className="hidden lg:block h-[calc(100vh-9.5rem)]">
                        <PanelGroup direction="horizontal" className="flex-1 overflow-scoll h-full">
                            <Panel defaultSize={55} minSize={42}>
                                <div className="h-full flex flex-col gap-4 p-5">
                                    <div className={`flex flex-col overflow-y-auto rounded-lg border-2 border-[#DBE2EF] bg-[#F9F7F7] shadow-lg p-4 ${isViewingDocument ? "h-[95%]" : "min-h-[60%]"}`}>
                                        <div className="flex-1 h-full">
                                            <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                        </div>
                                    </div>
                                    {!isViewingDocument && (
                                        <div className=" flex flex-col rounded-lg border-2 border-[#DBE2EF] bg-[#F9F7F7] shadow-lg p-4 overflow-y-auto">
                                            <div className="flex justify-between items-center">
                                                <h2 className="text-lg font-semibold text-[#112D4E]">Generate Podcast</h2>
                                                <Button
                                                    onClick={handleGeneratePodcast}
                                                    disabled={isGenerating || (documents?.length || 0) === 0}
                                                    className="mb-2 w-40 bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-[#DBE2EF] disabled:text-[#3F72AF]"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            Generating...
                                                        </>
                                                    ) : (
                                                        "Generate Podcast"
                                                    )}
                                                </Button>
                                            </div>
                                            {!isGenerating && <p className="text-xs sm:text-sm text-[#3F72AF] mb-2 sm:mb-3">
                                                Listen to an audio podcast summary of the uploaded documents.
                                            </p>}
                                            {isGenerating && (
                                                <p className="text-sm text-[#3F72AF]">Generating your podcast, till then chat with the documents.</p>
                                            )}
                                            {podcastUrl && !isGenerating && (
                                                <div className="space-y-2">
                                                    <div className="mb-2">
                                                        <audio controls className="w-full accent-[#3F72AF]">
                                                            <source src={podcastUrl} />
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Panel>
                            <PanelResizeHandle className="w-1 bg-[#DBE2EF] hover:bg-[#3F72AF] transition-colors flex items-center justify-center">
                                <div className="w-1 h-8 bg-[#3F72AF] rounded-full" />
                            </PanelResizeHandle>
                            <Panel defaultSize={45} minSize={45}>
                                <div className=" p-5 flex flex-col">
                                    <ChatWrapper chatId={chatIdStr} />
                                </div>
                            </Panel>
                        </PanelGroup>
                    </div>

                    {/* Mobile/Tablet Layout - Vertical Panels */}
                    <div className="h-full">
                        <PanelGroup direction="vertical" className="flex-1 overflow-hidden h-full">
                            <Panel defaultSize={50} minSize={45}>
                                <div className="h-full flex flex-col gap-4 p-3 sm:p-4">
                                    <div className={`flex flex-col overflow-y-auto rounded-lg border-2 border-[#DBE2EF] bg-[#F9F7F7] shadow-lg p-3 sm:p-4 ${isViewingDocument ? "flex-1" : "h-1/2"}`}>
                                        <div className="flex-1">
                                            <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                        </div>
                                    </div>
                                    {!isViewingDocument && (
                                        <div className="flex-1 flex flex-col rounded-lg border-2 border-[#DBE2EF] bg-[#F9F7F7] shadow-lg p-3 sm:p-4 min-h-[120px]">
                                            <h2 className="text-base sm:text-lg font-semibold text-[#112D4E]">Generate Podcast</h2>
                                            <p className="text-xs sm:text-sm text-[#3F72AF] mb-2 sm:mb-3">
                                                Generate an audio podcast summary of the uploaded documents.
                                            </p>
                                            <Button
                                                onClick={handleGeneratePodcast}
                                                disabled={isGenerating || (documents?.length || 0) === 0}
                                                className="mb-2 w-full sm:w-40 bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-[#DBE2EF] disabled:text-[#3F72AF] text-xs sm:text-sm"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-2" />
                                                        Generating...
                                                    </>
                                                ) : (
                                                    "Generate Podcast"
                                                )}
                                            </Button>
                                            {isGenerating && (
                                                <p className="text-xs sm:text-sm text-[#3F72AF]">Generating your podcast, till then chat with the documents.</p>
                                            )}
                                            {podcastUrl && !isGenerating && (
                                                <div className="space-y-2 mt-2">
                                                    <h3 className="font-semibold text-sm sm:text-base text-[#112D4E]">Podcast Audio</h3>
                                                    <div className="mb-2">
                                                        <audio controls className="w-full accent-[#3F72AF] h-8">
                                                            <source src={podcastUrl} />
                                                            Your browser does not support the audio element.
                                                        </audio>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Panel>
                            <PanelResizeHandle className="h-1 bg-[#DBE2EF] hover:bg-[#3F72AF] transition-colors flex items-center justify-center">
                                <div className="w-8 h-1 bg-[#3F72AF] rounded-full" />
                            </PanelResizeHandle>
                            <Panel defaultSize={50} minSize={50}>
                                <div className="h-full p-3 sm:p-4 flex flex-col">
                                    <div className="flex-1 overflow-hidden rounded-lg border-2 border-[#DBE2EF] bg-white shadow-lg">
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