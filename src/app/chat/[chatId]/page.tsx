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

export default function ChatPage() {
    const { chatId } = useParams();
    const router = useRouter();

    const chatIdStr = typeof chatId === "string" ? chatId : Array.isArray(chatId) ? chatId[0] ?? "" : "";

    const { data: chatDetails, isLoading: isChatDetailsLoading } = trpc.chat.getChatById.useQuery(
        { chatId: chatIdStr },
        { enabled: !!chatIdStr }
    );

    return (
        <div className='flex flex-col flex-1'> {/* Ensure full height */}
            {/* Header Section */}
            <div className="flex items-center justify-between py-4 px-12 border-b border-zinc-200 bg-zinc-50 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {isChatDetailsLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    ) : (
                        <h1 className="text-xl font-semibold truncate">
                            {chatDetails?.name || "Chat"}
                        </h1>
                    )}
                </div>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    Close Chat
                </Button>
            </div>

            {/* Content Area with Resizable Panels */}
            <PanelGroup direction="horizontal" className="flex-1 overflow-hidden"> {/* flex-1 to take remaining space */}
                <Panel defaultSize={55} minSize={30}>
                    {/* PDF Renderer Wrapper - ensure it fills the panel and handles its own scrolling if needed */}
                    <div className='h-full flex flex-col pt-2 xl:px-2 lg:pr-4 overflow-y-auto'>
                        <div className='px-4 sm:px-6 lg:pl-8 xl:flex-1 xl:pl-6'>
                            <PdfRenderer chatId={chatIdStr} />
                        </div>
                    </div>
                </Panel>
                <PanelResizeHandle className="w-2 bg-zinc-200 hover:bg-zinc-300 transition-colors flex items-center justify-center">
                    {/* Optional: Add a grabber icon here if desired */}
                    <div className="w-1 h-8 bg-zinc-400 rounded-full" />
                </PanelResizeHandle>
                <Panel defaultSize={45} minSize={30}>
                    {/* Chat Wrapper - ensure it fills the panel and handles its own internal layout/scrolling */}
                    <div className='h-full flex flex-col border-t border-zinc-300 lg:border-l lg:border-t-0'>
                        <ChatWrapper chatId={chatIdStr} />
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    );
}