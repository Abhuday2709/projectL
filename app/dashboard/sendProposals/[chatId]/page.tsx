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

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();
    const { toast } = useToast(); // Ensure useToast is called inside the component

    const chatIdStr = typeof chatId === "string" ? chatId : Array.isArray(chatId) ? chatId[0] ?? "" : "";

    const { data: chatDetails, isLoading: isChatDetailsLoading, refetch: refetchChatDetails } = trpc.chat.getChatById.useQuery(
        { chatId: chatIdStr },
        { enabled: !!chatIdStr }
    );
    const { data: documents, refetch } = trpc.documents.listByChat.useQuery(
        { chatId: chatIdStr },
        { enabled: !!chatIdStr }
    );
    const deleteFileMutation = trpc.aws.deleteFile.useMutation();
     const { data: shareSessionData, refetch: refetchShareSession } = trpc.shareSession.getByChatId.useQuery(
        { chatId: chatIdStr },
        { enabled: !!chatIdStr }
    );
    const updateShareSessionMutation = trpc.shareSession.updateShareSession.useMutation({
        onSuccess: () => {
            refetchShareSession();
            toast({
                title: "Share settings updated!",
                description: "Your share settings have been updated successfully.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error updating share settings",
                description: error.message,
                variant: "destructive",
            });
        }
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isViewingDocument, setIsViewingDocument] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [sharePassword, setSharePassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (chatDetails?.podcastFinal) {
            if (podcastUrl) {
                const urlParts = podcastUrl.split('/');
                const s3Key = urlParts.slice(3).join('/'); // Remove 'https://bucket.s3.region.amazonaws.com/'
                deleteFileMutation.mutate({ key: s3Key });
            }
            setIsGenerating(false);
            setPodcastUrl(chatDetails.podcastFinal);
        }
    }, [chatDetails?.podcastFinal]);
    const handleGeneratePodcast = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const { data: latestDocuments } = await refetch();
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
        
        updateShareSessionMutation.mutate({
            chatId: chatIdStr,
            password: hashedPassword,
            isActive: shareSessionData?.isActive ?? true
        });
        
        setIsChangingPassword(false);
        setSharePassword("");
    };
    const handleToggleActive = async () => {
        const newActiveState = !shareSessionData?.isActive;
        
        updateShareSessionMutation.mutate({
            chatId: chatIdStr,
            password: shareSessionData?.password || "",
            isActive: newActiveState
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
        <div>
            <Sidebar />
            <div className="flex flex-col flex-1 ml-64">
                <div className="flex items-center justify-between py-4 px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {isChatDetailsLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                        ) : (
                            <h1 className="text-xl font-semibold truncate bg-white px-4 py-2 rounded shadow-sm">
                                {chatDetails?.name || "Chat"}
                            </h1>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setShowShareDialog(true)}>
                            {shareSessionData?.password && shareSessionData?.isActive ? "Manage Share" : "Share Chat"}
                        </Button>
                        <Button variant="default" onClick={() => router.push("/dashboard/sendProposals")}>
                            Close Chat
                        </Button>
                    </div>
                </div>

                <PanelGroup direction="horizontal" className="flex-1 overflow">
                    <Panel defaultSize={55} minSize={42}>
                        <div className="h-full flex flex-col gap-4 m-5">
                            <div className={`flex flex-col overflow-y-auto rounded-lg border bg-white shadow-sm p-4 ${isViewingDocument ? "h-[95%]" : "h-[70%]"}`}>
                                <div className="xl:flex-1">
                                    <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                </div>
                            </div>
                            {!isViewingDocument && (
                                <div className="min-h-[40%] flex flex-col rounded-lg border bg-white shadow-sm p-4 mb-10">
                                    <h2 className="text-lg font-semibold">Generate Podcast</h2>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Generate an audio podcast summary of the uploaded documents.
                                    </p>
                                    <Button
                                        onClick={handleGeneratePodcast}
                                        disabled={isGenerating || (documents?.length || 0) === 0}
                                        className="mb-2 w-40"
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
                                    {isGenerating && (
                                        <p className="text-sm text-gray-500">Generating your podcast, till then chat with the documents.</p>
                                    )}
                                    {podcastUrl && !isGenerating && (
                                        <div className="space-y-2 mt-2">
                                            <h3 className="font-semibold text-base">Podcast Audio</h3>
                                            <div className="mb-2">
                                                <audio controls className="w-full">
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
                    <PanelResizeHandle className="w-1 bg-gray-100 hover:bg-zinc-300 transition-colors flex items-center justify-center">
                        <div className="w-1 h-8 bg-zinc-400 rounded-full" />
                    </PanelResizeHandle>
                    <Panel defaultSize={45} minSize={45}>
                        <div className="h-full m-5 flex flex-col border-t border-zinc-300 lg:border-l lg:border-t-0">
                            <ChatWrapper chatId={chatIdStr} />
                        </div>
                    </Panel>
                </PanelGroup>
            </div>

            {/* Share Dialog */}
            {showShareDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
                        {!shareSessionData?.password ? (
                            // Create new share session
                            <>
                                <h2 className="text-lg font-semibold mb-4">Create Share Link</h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    Set a password to allow others to access this chat.
                                </p>
                                <input
                                    type="password"
                                    className="w-full border rounded px-3 py-2 mb-4"
                                    placeholder="Enter password"
                                    value={sharePassword}
                                    onChange={(e) => setSharePassword(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => {
                                            setShowShareDialog(false);
                                            setSharePassword("");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUpdatePassword}
                                        disabled={!sharePassword.trim()}
                                    >
                                            Create
                                    </Button>
                                </div>
                            </>
                        ) : (
                            // Manage existing share session
                            <>
                                <h2 className="text-lg font-semibold mb-4">Manage Share Link</h2>
                                
                                {/* Share URL */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Share URL
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 font-mono text-sm bg-gray-50 p-2 rounded border break-all">
                                            {shareUrl}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(shareUrl)}
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    {isChangingPassword ? (
                                        <div className="space-y-2">
                                            <input
                                                type="password"
                                                className="w-full border rounded px-3 py-2"
                                                placeholder="Enter new password"
                                                value={sharePassword}
                                                onChange={(e) => setSharePassword(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleUpdatePassword}
                                                    disabled={!sharePassword.trim()}
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
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 font-mono text-sm bg-gray-50 p-2 rounded border">
                                                {"•".repeat(shareSessionData.password?.length || 0)}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsChangingPassword(true)}
                                            >
                                                Change
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Active Toggle */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Share Status
                                            </label>
                                            <p className="text-xs text-gray-500">
                                                {shareSessionData.isActive 
                                                    ? "Share link is active and accessible" 
                                                    : "Share link is disabled"
                                                }
                                            </p>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="isActive"
                                                checked={shareSessionData.isActive ?? false}
                                                onChange={handleToggleActive}
                                                className="mr-2"
                                            />
                                            <label htmlFor="isActive" className="text-sm">
                                                Active
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-between">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => {
                                            setShowShareDialog(false);
                                            setIsChangingPassword(false);
                                            setSharePassword("");
                                        }}
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