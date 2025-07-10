"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Copy, Check, Calendar, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
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
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{ message: string; color: string; isWeak: boolean }>({ message: "", color: "", isWeak: true });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const checkPasswordStrength = (password: string) => {
        let score = 0;
        let message = "";
        let color = "text-gray-500";
        let isWeak = true;

        if (!password) {
            setPasswordFeedback({ message: "", color: "", isWeak: true });
            return;
        }

        const commonPasswords = ["123456", "password", "12345678", "qwerty", "123456789"];
        if (commonPasswords.includes(password.toLowerCase())) {
            setPasswordFeedback({ message: "Very weak: This password is too common.", color: "text-red-500", isWeak: true });
            return;
        }

        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (password.length > 0 && password.length < 8) {
            message = "Weak: Must be at least 8 characters.";
            color = "text-red-500";
            isWeak = true;
        } else {
            switch (score) {
                case 0:
                case 1:
                case 2:
                    message = "Strength: Weak";
                    color = "text-red-500";
                    isWeak = true;
                    break;
                case 3:
                case 4:
                    message = "Strength: Medium";
                    color = "text-orange-500";
                    isWeak = true;
                    break;
                case 5:
                    message = "Strength: Strong";
                    color = "text-green-500";
                    isWeak = false;
                    break;
                default:
                    message = "";
                    isWeak = true;
            }
        }
        setPasswordFeedback({ message, color, isWeak });
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setSharePassword(newPassword);
        checkPasswordStrength(newPassword);
    };

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
        if (!sharePassword.trim() || passwordFeedback.isWeak) {
            toast({ title: "Weak Password", description: "Please choose a stronger password.", variant: "destructive" });
            return;
        }
        setIsUpdatingPassword(true);
        const hashedPassword = await bcrypt.hash(sharePassword.trim(), 10);
        await updateShareSession({
            chatId: chatId,
            password: hashedPassword,
            validityDays: validityDays,
        });
        setIsUpdatingPassword(false);
        setIsChangingPassword(false);
        setSharePassword("");
        setPasswordFeedback({ message: "", color: "", isWeak: true });
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
                className=" bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
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
                                <div className="relative mb-1">
                                    <input
                                        type={isPasswordVisible ? "text" : "password"}
                                        className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-sm pr-10"
                                        placeholder="Enter password"
                                        value={sharePassword}
                                        onChange={handlePasswordChange}
                                    />
                                    <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                        {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                                {passwordFeedback.message && <p className={`text-xs mt-1 ${passwordFeedback.color}`}>{passwordFeedback.message}</p>}
                                <div className="flex items-center gap-2 my-4">
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
                                    <Button onClick={handleUpdatePassword} disabled={!sharePassword.trim() || passwordFeedback.isWeak} className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-gray-400 disabled:cursor-not-allowed text-sm order-1 sm:order-2">Create</Button>
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
                                            <div className="relative">
                                                <input
                                                    type={isPasswordVisible ? "text" : "password"}
                                                    className="w-full border-2 border-[#DBE2EF] rounded-lg px-3 py-2 focus:border-[#3F72AF] focus:outline-none bg-[#F9F7F7] text-sm pr-10"
                                                    placeholder="Enter new password"
                                                    value={sharePassword}
                                                    onChange={handlePasswordChange}
                                                />
                                                <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
                                                    {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                            {passwordFeedback.message && <p className={`text-xs mt-1 ${passwordFeedback.color}`}>{passwordFeedback.message}</p>}
                                            <div className="flex items-center gap-2 pt-2">
                                                <label className="block text-xs text-[#112D4E]">Valid for (days):</label>
                                                <input type="number" min={1} className="border-2 border-[#DBE2EF] rounded-lg px-2 py-1 w-20 bg-[#F9F7F7] text-sm" value={validityDays} onChange={e => setValidityDays(parseInt(e.target.value, 10) || 1)} />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleUpdatePassword}
                                                    disabled={!sharePassword.trim() || passwordFeedback.isWeak || isUpdatingPassword}
                                                    className="bg-[#3F72AF] hover:bg-[#112D4E] text-white border-none disabled:bg-gray-400 disabled:cursor-not-allowed text-xs"
                                                >
                                                    {isUpdatingPassword ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        "Update"
                                                    )}
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => { setIsChangingPassword(false); setSharePassword(""); setPasswordFeedback({ message: "", color: "", isWeak: true }); }} className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover:text-white text-xs">Cancel</Button>
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
                                    <Button variant="secondary" onClick={() => { setShowShareDialog(false); setIsChangingPassword(false); setSharePassword(""); setPasswordFeedback({ message: "", color: "", isWeak: true }); }} className="bg-[#DBE2EF] hover:bg-[#3F72AF] text-[#112D4E] hover:text-white border-none text-sm">Close</Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}