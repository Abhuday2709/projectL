"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Copy, Check, Calendar, AlertCircle } from "lucide-react";
import { ShareSession } from "@/models/shareSessionModel";

interface ShareChatDialogProps {
    chatId: string;
}

export default function ShareChatDialog({ chatId }: ShareChatDialogProps) {
    const { toast } = useToast();
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [sharePassword, setSharePassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    const [validityDays, setValidityDays] = useState(7); // Default to 7 days
    const [shareSessionData, setShareSessionData] = useState<ShareSession | null>(null);

    const fetchShareSession = async () => {
        if (!chatId) return;
        try {
            const res = await fetch(`/api/shareSession/byChatId?chatId=${chatId}`);
            if (res.status === 404) {
                setShareSessionData(null);
                return;
            }
            if (!res.ok) throw new Error('Share session not found');
            const data = await res.json();
            setShareSessionData(data);
        } catch (err) {
            console.error("Failed to fetch shareSessionData", err);
            setShareSessionData(null);
        }
    };

    const updateShareSession = async (payload: { chatId: string; password?: string; isActive?: boolean; validityDays?: number }) => {
        try {
            const res = await fetch("/api/shareSession/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to update share session");
            }
            toast({
                title: "Share settings updated!",
                description: "Your share settings have been updated successfully.",
            });
            // Refetch data to ensure UI is in sync
            await fetchShareSession();
        } catch (error: any) {
            toast({
                title: "Error updating share settings",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        if (chatId) {
            fetchShareSession();
        }
    }, [chatId]);

    const handleUpdatePassword = async () => {
        if (!sharePassword.trim()) {
            toast({ title: "Password required", description: "Please enter a new password.", variant: "destructive" });
            return;
        }
        const hashedPassword = await bcrypt.hash(sharePassword.trim(), 10);
        await updateShareSession({
            chatId: chatId,
            password: hashedPassword,
            validityDays: validityDays,
        });
        setIsChangingPassword(false);
        setSharePassword("");
    };

    const handleToggleActive = async () => {
        if (!shareSessionData) return;
        const newActiveState = !shareSessionData.isActive;
        await updateShareSession({
            chatId: chatId,
            isActive: newActiveState,
        });
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({ title: "Copied to clipboard!", description: "Share link has been copied to your clipboard." });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast({ title: "Failed to copy", description: "Please copy the link manually.", variant: "destructive" });
        }
    };

    const getExpirationDetails = () => {
        if (!shareSessionData?.expiresAt) return { text: "No expiration set.", isExpired: false };
        const expiresDate = new Date(shareSessionData.expiresAt * 1000);
        const now = new Date();
        const isExpired = now > expiresDate;
        const formattedDate = expiresDate.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return {
            text: `Expires on: ${formattedDate}`,
            isExpired: isExpired,
        };
    };

    const expirationDetails = getExpirationDetails();
    const shareUrl = `${process.env.NEXT_PUBLIC_WEBSITE_URL}/s/${shareSessionData?.shareId}`;

    return (
        <>
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

            {showShareDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112D4E] bg-opacity-60 p-4">
                    <div className="bg-[#F9F7F7] rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-sm sm:max-w-2xl border-2 border-[#DBE2EF] max-h-[90vh] overflow-y-auto">
                        {!shareSessionData?.password ? (
                            <>
                                <h2 className="text-base sm:text-lg font-semibold mb-3 text-[#112D4E]">Create Share Link</h2>
                                <p className="text-xs sm:text-sm text-[#3F72AF] mb-3">Set a password to allow others to access this chat.</p>
                                <input
                                    type="password"
                                    className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 mb-3 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-[#112D4E] text-sm"
                                    placeholder="Enter password"
                                    value={sharePassword}
                                    onChange={(e) => setSharePassword(e.target.value)}
                                />
                                <div className="flex items-center gap-2 mb-4">
                                    <label className="block text-xs sm:text-sm text-[#112D4E]">Valid for (days):</label>
                                    <input
                                        type="number"
                                        min={1}
                                        className="border-2 border-[#DBE2EF] rounded-lg px-2 py-1 w-20 bg-[#F9F7F7] text-sm"
                                        value={validityDays}
                                        onChange={e => setValidityDays(parseInt(e.target.value, 10) || 1)}
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row justify-end gap-2">
                                    <Button variant="secondary" onClick={() => { setShowShareDialog(false); setSharePassword(""); }} className="bg-[#DBE2EF] hover:bg-[#3F72AF] text-[#112D4E] hover:text-white border-none text-sm order-2 sm:order-1">Cancel</Button>
                                    <Button onClick={handleUpdatePassword} disabled={!sharePassword.trim()} className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-gray-300 text-sm order-1 sm:order-2">Create</Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-base sm:text-lg font-semibold mb-3 text-[#112D4E]">Manage Share Link</h2>
                                <div className="mb-3">
                                    <label className="block text-xs sm:text-sm font-medium text-[#112D4E] mb-2">Share URL</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 font-mono text-xs sm:text-sm bg-[#DBE2EF] text-[#112D4E] p-2 rounded-lg border break-all">{shareUrl}</div>
                                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareUrl)} className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-xs sm:text-sm font-medium text-[#112D4E] mb-2">Password</label>
                                    {isChangingPassword ? (
                                        <div className="space-y-2">
                                            <input type="password" className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-sm" placeholder="Enter new password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} />
                                            <div className="flex items-center gap-2">
                                                <label className="block text-xs text-[#112D4E]">Valid for (days):</label>
                                                <input type="number" min={1} className="border-2 border-[#DBE2EF] rounded-lg px-2 py-1 w-20 bg-[#F9F7F7] text-sm" value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value, 10) || 1)} />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={handleUpdatePassword} disabled={!sharePassword.trim()} className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-gray-300 text-xs">Update</Button>
                                                <Button size="sm" variant="outline" onClick={() => { setIsChangingPassword(false); setSharePassword(""); }} className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white text-xs">Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 font-mono text-xs sm:text-sm bg-[#DBE2EF] text-[#112D4E] p-2 rounded-lg border">{"•".repeat(8)}</div>
                                            <Button size="sm" variant="outline" onClick={() => setIsChangingPassword(true)} className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white">Change</Button>
                                        </div>
                                    )}
                                </div>
                                <div className="mb-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs sm:text-sm font-medium text-[#112D4E]">Share Status</label>
                                        <div className="flex items-center">
                                            <input type="checkbox" id="isActive" checked={shareSessionData.isActive ?? false} onChange={handleToggleActive} className="mr-2 accent-[#3F72AF] scale-110" />
                                            <label htmlFor="isActive" className="text-xs sm:text-sm text-[#112D4E]">{shareSessionData.isActive ? "Active" : "Inactive"}</label>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${expirationDetails.isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {expirationDetails.isExpired ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                                        <span>{expirationDetails.text}</span>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button variant="secondary" onClick={() => { setShowShareDialog(false); setIsChangingPassword(false); setSharePassword(""); }} className="bg-[#DBE2EF] hover:bg-[#3F72AF] text-[#112D4E] hover:text-white border-none text-sm">Close</Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}