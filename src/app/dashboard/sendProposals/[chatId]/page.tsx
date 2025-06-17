"use client";
import { useParams, useRouter } from "next/navigation";
import ChatWrapper from "@/components/chat/ChatWrapper";
import PdfRenderer from "@/components/PdfRenderer";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
// Import from react-resizable-panels
import {
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";
import Sidebar from "@/components/Sidebar";
import { useState } from "react";

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();

    const chatIdStr = typeof chatId === "string" ? chatId : Array.isArray(chatId) ? chatId[0] ?? "" : "";

    const { data: chatDetails, isLoading: isChatDetailsLoading } = trpc.chat.getChatById.useQuery(
        { chatId: chatIdStr },
        { enabled: !!chatIdStr }
    );

    // Podcast generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isViewingDocument, setIsViewingDocument] = useState(false);

    // Dummy podcast generation handler (replace with your actual logic)
    const handleGeneratePodcast = async () => {
        setIsGenerating(true);
        setError(null);
        setPodcastUrl(null);
        try {
            // Simulate API call
            await new Promise((res) => setTimeout(res, 2000));
            // Set a dummy podcast URL (replace with real URL from your backend)
            setPodcastUrl("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
        } catch (err) {
            setError("Failed to generate podcast. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <div>
            <Sidebar />
            <div className='flex flex-col flex-1 ml-64'> {/* Remove ml-64 since sidebar is hidden */}
                {/* Header Section */}
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
                    <Button variant="default" onClick={() => router.push('/dashboard/sendProposals')}>
                        Close Chat
                    </Button>
                </div>

                {/* Content Area with Resizable Panels */}
                <PanelGroup direction="horizontal" className="flex-1 overflow-hidden"> {/* flex-1 to take remaining space */}
                    <Panel defaultSize={55} minSize={30}>
                        {/* Split left panel: 70% PDF, 30% Podcast */}
                        <div className="min-h-full flex flex-col gap-4 m-5">
                            {/* PDF Renderer - 70% */}
                            <div className="flex-[7] flex flex-col overflow-y-auto rounded-lg border bg-white shadow-sm p-4">
                                <div className="xl:flex-1">
                                    <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} />
                                </div>
                            </div>
                            {/* Podcast Generator - 30% */}
                            {!isViewingDocument && (
                                <div className="flex-[3] flex flex-col rounded-lg border bg-white shadow-sm p-4 mb-10">
                                    <h2 className="text-lg font-semibold mb-2">Generate Podcast</h2>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Generate an audio podcast summary of the uploaded document.
                                    </p>
                                    <Button
                                        onClick={handleGeneratePodcast}
                                        disabled={isGenerating}
                                        className="mb-4 w-40"
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
                                    {error && (
                                        <div className="text-red-500 text-sm mb-2">{error}</div>
                                    )}
                                    {podcastUrl && (
                                        <audio controls className="w-full mt-2">
                                            <source src={podcastUrl} type="audio/mpeg" />
                                            Your browser does not support the audio element.
                                        </audio>
                                    )}
                                </div>
                            )}
                        </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-gray-100 hover:bg-zinc-300 transition-colors flex items-center justify-center">
                        {/* Optional: Add a grabber icon here if desired */}
                        <div className="w-1 h-8 bg-zinc-400 rounded-full" />
                    </PanelResizeHandle>
                    <Panel defaultSize={45} minSize={30}>
                        {/* Chat Wrapper - ensure it fills the panel and handles its own internal layout/scrolling */}
                        <div className='h-full m-5 flex flex-col border-t border-zinc-300 lg:border-l lg:border-t-0'>
                            <ChatWrapper chatId={chatIdStr} />
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}