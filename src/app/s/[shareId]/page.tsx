"use client";

import { notFound, useParams } from "next/navigation";
import ChatWrapper from "@/components/chat/ChatWrapper";
import PdfRenderer from "@/components/PdfRenderer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useState, useEffect } from "react";
import bcrypt from "bcryptjs";

export default function ChatPage() {
    const { shareId } = useParams();

    const shareIdStr = typeof shareId === "string" ? shareId : Array.isArray(shareId) ? shareId[0] ?? "" : "";
    const [shareSession, setShareSession] = useState<{
        shareId: string;
        chatId: string;
        password: string;
        isActive: boolean;
    } | null>(null);
    const [isShareSessionLoading, setIsShareSessionLoading] = useState(true);
    const [shareSessionError, setShareSessionError] = useState<null | string>(null);

    const fetchShareSession = async () => {
        if (!shareIdStr) return;
        try {
            const res = await fetch(`/api/shareSession/byShareId?shareId=${shareIdStr}`);
            if (!res.ok) throw new Error("Share session not found");
            const data = await res.json();
            setShareSession(data);
        } catch (err: any) {
            setShareSessionError(err.message);
        } finally {
            setIsShareSessionLoading(false);
        }
    };
    useEffect(() => {
        fetchShareSession();
    }, [shareIdStr]);

    // Password dialog state
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [isPasswordVerified, setIsPasswordVerified] = useState(false);

    // If not found, show 404
    if (!shareSession && !isShareSessionLoading) {
        notFound();
    }

    // Password check handler
    async function handlePasswordCheck() {
        if (!shareSession?.password) return;
        const isMatch = await bcrypt.compare(passwordInput, shareSession.password);
        if (isMatch) {
            setIsPasswordVerified(true);
        } else {
            setPasswordError("Incorrect password. Please try again.");
        }
    }
    const chatIdStr = shareSession?.chatId || "";
    const [isGenerating, setIsGenerating] = useState(false);
    const [isViewingDocument, setIsViewingDocument] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);


    // If loading, show nothing
    if (isShareSessionLoading) return null;

    // If password is set and not verified, show password dialog
    if (shareSession?.password && !isPasswordVerified) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                    <h2 className="text-lg font-semibold mb-4">Enter password to view this chat</h2>
                    <input
                        type="password"
                        className="w-full border rounded px-3 py-2 mb-4"
                        placeholder="Password"
                        value={passwordInput}
                        onChange={e => {
                            setPasswordInput(e.target.value);
                            setPasswordError("");
                        }}
                        onKeyDown={e => {
                            if (e.key === "Enter") handlePasswordCheck();
                        }}
                    />
                    {passwordError && (
                        <div className="text-red-500 text-sm mb-2">{passwordError}</div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            onClick={handlePasswordCheck}
                            disabled={!passwordInput}
                        >
                            Submit
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div>
            <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between py-4 px-4 flex-shrink-0 border-b border-gray-300">
                    <div
                        className={`${buttonVariants({ variant: 'ghost', size: 'lg' })} p-2 transition-transform duration-150 ease-in-outhover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 active:scale-95`}>
                        <span className='text-2xl '>Network Science</span>
                    </div>
                </div>
                <PanelGroup direction="horizontal" className="flex-1 overflow">
                    <Panel defaultSize={55} minSize={42}>
                        <div className="h-full flex flex-col gap-4 m-5">
                            <div className={`flex flex-col overflow-y-auto rounded-lg border bg-white shadow-sm p-4 ${isViewingDocument ? "h-[95%]" : "h-[70%]"}`}>
                                <div className="xl:flex-1">
                                    <PdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument} isClient={true} />
                                </div>
                            </div>
                            {!isViewingDocument && (
                                <div className="min-h-[30%] flex flex-col rounded-lg border bg-white shadow-sm p-4 mb-10">
                                    <h2 className="text-lg font-semibold">Podcast</h2>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Listen to an audio podcast summary of the uploaded documents.
                                    </p>
                                    {podcastUrl && !isGenerating && (
                                        <div className="space-y-2 mt-2">
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
                        <div className="h-full m-5 flex flex-col">
                            <ChatWrapper chatId={chatIdStr} />
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}