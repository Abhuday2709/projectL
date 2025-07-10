"use client";

import { notFound, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useState, useEffect } from "react";
import bcrypt from "bcryptjs";
import { Chat } from "@/models/chatModel";
import Image from "next/image";
import ClientPdfRenderer from "./components/clientPdfRenderer";
import ChatWrapper from "./components/chat/ChatWrapper";
import { ShareSession } from "@/models/shareSessionModel";

export default function ChatPage() {
    const { shareId } = useParams();

    const shareIdStr = typeof shareId === "string" ? shareId : Array.isArray(shareId) ? shareId[0] ?? "" : "";
    console.log("Share ID:", shareIdStr);
    
    const [shareSession, setShareSession] = useState<ShareSession | null>(null);
    const [isShareSessionLoading, setIsShareSessionLoading] = useState(true);
    const [shareSessionError, setShareSessionError] = useState<null | string>(null);

    const fetchShareSession = async () => {
        if (!shareIdStr) return;
        try {
            console.log("Fetching share session for ID:", shareIdStr);
            
            const res = await fetch(`/api/shareSession/byShareId?shareId=${shareIdStr}`);
            console.log("Response status:", res.ok);
            if (!res.ok) throw new Error("Share session not found");
            const data = await res.json();
            console.log("Fetched share session:", data);
            setShareSession(data);
        } catch (err: any) { 
            console.log("Error fetching share session:", err);
            
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

    // If not found or inactive, show 404
    if (!shareSession && !isShareSessionLoading) {
        notFound();
    }

    // If share session is inactive, show 404
    if (shareSession && (shareSession.isActive === false) || (shareSession?.expiresAt && new Date(shareSession.expiresAt) < new Date())) {
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

    const [chatDetails, setChatDetails] = useState<Chat | null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatIdStr = shareSession?.chatId || "";

    const fetchChatDetails = async () => {
        if (!chatIdStr) return;
        setIsChatLoading(true);
        try {
            const res = await fetch(`/api/chat/${chatIdStr}`);
            if (!res.ok) throw new Error("Chat not found");
            const data = await res.json();
            console.log("Fetched chat details:", data);
            
            setChatDetails(data);
            if (data.podcastFinal) {
                setPodcastUrl(data.podcastFinal);
            } else {
                setPodcastUrl(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsChatLoading(false);
        }
    };

    useEffect(() => {
        if (isPasswordVerified) {
            // Clear session storage for a new session - REMOVED
            fetchChatDetails();
        }
    }, [isPasswordVerified, shareIdStr]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isViewingDocument, setIsViewingDocument] = useState(false);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);


    // If loading, show nothing
    if (isShareSessionLoading) return null;

    // If password is set and not verified, show password dialog
    if (shareSession?.password && !isPasswordVerified) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md border">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900">Enter password to view this chat</h2>
                    <input
                        type="password"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        <div className="text-red-600 text-sm mb-2">{passwordError}</div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button
                            onClick={handlePasswordCheck}
                            disabled={!passwordInput}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            Submit
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center justify-between py-4 px-4 flex-shrink-0 border-b border-gray-200 bg-white">
                    <div className="transition-transform duration-150 ease-in-out hover:scale-105">
                        <Image
                            src="/NetworkScienceLogo.png"
                            alt="Logo"
                            width={120}
                            height={40}
                        />
                    </div>
                </div>
                <PanelGroup direction="horizontal" className="flex-1 overflow">
                    <Panel defaultSize={55} minSize={42}>
                        <div className="h-full flex flex-col gap-4 p-4">
                            <div className={`bg-white flex flex-col overflow-y-auto rounded-lg border border-gray-200 shadow-sm p-4 ${isViewingDocument ? "h-[95%]" : "h-[70%]"}`}>
                                <div className="flex-1">
                                    <ClientPdfRenderer chatId={chatIdStr} setIsViewingDocument={setIsViewingDocument}/>
                                </div>
                            </div>
                            {!isViewingDocument && (
                                <div className="min-h-[30%] flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm p-4">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Podcast</h2>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Listen to an audio podcast summary of the uploaded documents.
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
                        <div className="h-full p-4 flex flex-col">
                            <div className="flex-1 rounded-lg border border-gray-200 bg-white shadow-sm p-4">
                                <ChatWrapper chatId={chatIdStr} shareId={shareIdStr} />
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
}