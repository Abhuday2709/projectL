"use client";

import React, { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, Shield, ArrowLeft, CheckCircle, KeyRound, Loader2, Clock, Users, Zap, Award } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isNetworkScienceEmail } from '@/lib/utils';

type ViewState = 'signin' | 'forgot-password' | 'reset-code';

export default function SignIn() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const { isSignedIn } = useAuth();
    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentView, setCurrentView] = useState<ViewState>('signin');
    const router = useRouter();

    useEffect(() => {
        if (isSignedIn) {
            router.push('/dashboard');
        }
    }, [isSignedIn, router]);

    if (!isLoaded || !signIn  || isSignedIn) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F9F7F7]">
                <Loader2 className="h-12 w-12 animate-spin text-[#3F72AF]" />
            </div>
        );
    }

    const resetState = (view: ViewState = 'signin') => {
        setError("");
        setSuccess("");
        setCurrentView(view);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!signIn) return;

        if (!isNetworkScienceEmail(emailAddress)) {
            setError("Only @networkscience.ai email addresses are allowed.");
            return;
        }

        setIsLoading(true);
        resetState();
        try {
            const result = await signIn.create({
                identifier: emailAddress,
                password,
            });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: any) {
            setError(err.errors?.[0]?.message || "Sign in failed. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleForgotPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!signIn) return;

        if (!isNetworkScienceEmail(emailAddress)) {
            setError("Only @networkscience.ai email addresses are allowed.");
            return;
        }

        setIsLoading(true);
        resetState('forgot-password');
        try {
            await signIn.create({
                identifier: emailAddress,
                strategy: "reset_password_email_code",
            });
            setSuccess("Password reset code sent to your email!");
            setCurrentView('reset-code');
        } catch (err: any) {
            setError(err.errors?.[0]?.message || "Failed to send reset code.");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleVerifyResetCode(e: React.FormEvent) {
        e.preventDefault();
        if (!signIn) return;

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        setIsLoading(true);
        resetState('reset-code');
        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "reset_password_email_code",
                code: resetCode,
                password: newPassword,
            });

            if (result.status === "complete") {
                setSuccess("Password reset successful! Signing you in...");
                await setActive({ session: result.createdSessionId });
                setTimeout(() => router.push("/dashboard"), 1500);
            }
        } catch (err: any) {
            setError(err.errors?.[0]?.message || "Failed to reset password. Please check the code.");
        } finally {
            setIsLoading(false);
        }
    }

    const renderSignInView = () => (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email" className="text-[#112D4E]">Email Address</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#112D4E]/50" />
                    <Input 
                        type="email" 
                        id="email" 
                        value={emailAddress} 
                        onChange={(e) => setEmailAddress(e.target.value)} 
                        placeholder="yourname@networkscience.ai" 
                        className="pl-10 border-[#DBE2EF] focus:border-[#3F72AF]" 
                        required 
                        disabled={isLoading} 
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="password" className="text-[#112D4E]">Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#112D4E]/50" />
                    <Input 
                        type={showPassword ? "text" : "password"} 
                        id="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="pl-10 pr-10 border-[#DBE2EF] focus:border-[#3F72AF]" 
                        required 
                        disabled={isLoading} 
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-[#112D4E]/50 hover:text-[#3F72AF]" 
                        disabled={isLoading}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="text-right">
                    <Button 
                        type="button" 
                        variant="link" 
                        className="h-auto p-0 text-sm text-[#3F72AF] hover:text-[#112D4E] hover:bg-[#DBE2EF]/30" 
                        onClick={() => setCurrentView('forgot-password')}
                    >
                        Forgot password?
                    </Button>
                </div>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button 
                type="submit" 
                className="w-full bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                disabled={isLoading}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
            </Button>
        </form>
    );

    const renderForgotPasswordView = () => (
        <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[#112D4E]">Email Address</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#112D4E]/50" />
                    <Input 
                        type="email" 
                        id="reset-email" 
                        value={emailAddress} 
                        onChange={(e) => setEmailAddress(e.target.value)} 
                        placeholder="yourname@networkscience.ai" 
                        className="pl-10 border-[#DBE2EF] focus:border-[#3F72AF]" 
                        required 
                        disabled={isLoading} 
                    />
                </div>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button 
                type="submit" 
                className="w-full bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                disabled={isLoading}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Code
            </Button>
        </form>
    );

    const renderResetCodeView = () => (
        <form onSubmit={handleVerifyResetCode} className="space-y-4">
            <Alert className="border-[#DBE2EF]">
                <Mail className="h-4 w-4 text-[#3F72AF]" />
                <AlertTitle className="text-[#112D4E]">Check your email</AlertTitle>
                <AlertDescription className="text-[#112D4E]/70">
                    Enter the code sent to <span className="font-semibold text-[#3F72AF]">{emailAddress}</span>.
                </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor="reset-code" className="text-[#112D4E]">Reset Code</Label>
                <Input 
                    id="reset-code" 
                    value={resetCode} 
                    onChange={(e) => setResetCode(e.target.value)} 
                    placeholder="Enter 6-digit code" 
                    className="text-center tracking-[0.5em] border-[#DBE2EF] focus:border-[#3F72AF]" 
                    maxLength={6} 
                    required 
                    disabled={isLoading} 
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="new-password" className="text-[#112D4E]">New Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#112D4E]/50" />
                    <Input 
                        type={showNewPassword ? "text" : "password"} 
                        id="new-password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        className="pl-10 pr-10 border-[#DBE2EF] focus:border-[#3F72AF]" 
                        required 
                        disabled={isLoading} 
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setShowNewPassword(!showNewPassword)} 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-[#112D4E]/50 hover:text-[#3F72AF]" 
                        disabled={isLoading}
                    >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-[#112D4E]">Confirm New Password</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#112D4E]/50" />
                    <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        id="confirm-password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        className="pl-10 pr-10 border-[#DBE2EF] focus:border-[#3F72AF]" 
                        required 
                        disabled={isLoading} 
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-[#112D4E]/50 hover:text-[#3F72AF]" 
                        disabled={isLoading}
                    >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="border-[#DBE2EF]"><AlertDescription className="text-[#112D4E]">{success}</AlertDescription></Alert>}
            <Button 
                type="submit" 
                className="w-full bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Reset Password
            </Button>
        </form>
    );

    const viewConfig = {
        signin: { title: "Welcome Back", description: "Sign in to your PROJECT-L account", icon: <Shield className="h-10 w-10 text-[#3F72AF]" />, content: renderSignInView() },
        'forgot-password': { title: "Reset Password", description: "Enter your email to receive a reset code", icon: <KeyRound className="h-10 w-10 text-[#3F72AF]" />, content: renderForgotPasswordView() },
        'reset-code': { title: "Enter Reset Code", description: "Create a new secure password", icon: <Mail className="h-10 w-10 text-[#3F72AF]" />, content: renderResetCodeView() },
    }[currentView];

    return (
        <div className="h-[calc(100vh-3.5rem)] bg-[#F9F7F7] flex items-center justify-center px-4 py-12">
            {/* Left Side - Information */}
            <div className="hidden lg:block w-full max-w-md">
                <Card className="h-full bg-gradient-to-br from-[#112D4E] to-[#3F72AF] text-white border-none shadow-lg rounded-r-none">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Why PROJECT-L?</CardTitle>
                        <CardDescription className="text-blue-100">
                            Enterprise-ready document intelligence
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Quick Setup</h4>
                                <p className="text-xs text-blue-100">Get started in minutes, not hours</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Team Ready</h4>
                                <p className="text-xs text-blue-100">Built for collaboration and sharing</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">AI Powered</h4>
                                <p className="text-xs text-blue-100">Advanced document processing</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Award className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Enterprise</h4>
                                <p className="text-xs text-blue-100">Professional grade security</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <div className="w-full p-3 bg-white/10 rounded-lg border border-white/20 text-center">
                            <div className="text-lg font-bold mb-1">4 Core Features</div>
                            <div className="text-xs text-blue-100">Chat • Podcasts • Sharing • Reviews</div>
                        </div>
                    </CardFooter>
                </Card>
            </div>

            {/* Right Side - Sign In Form */}
            <div className="w-full max-w-md">
                <Card className="shadow-lg border-[#DBE2EF] rounded-l-none">
                    <CardHeader className="text-center">
                        {/* <div className="mx-auto mb-2">{viewConfig.icon}</div> */}
                        <CardTitle className="text-2xl font-bold text-[#112D4E]">{viewConfig.title}</CardTitle>
                        <CardDescription className="text-[#112D4E]/70">{viewConfig.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {currentView !== 'signin' && (
                            <Button 
                                variant="ghost" 
                                onClick={() => setCurrentView('signin')} 
                                className="mb-4 text-[#3F72AF] hover:text-[#112D4E] hover:bg-[#DBE2EF]/30"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
                            </Button>
                        )}
                        {viewConfig.content}
                    </CardContent>
                    <CardFooter className="justify-center">
                        <p className="text-sm text-[#112D4E]/70">
                            {currentView === 'signin' ? "Don't have an account?" : "Remember your password?"}{' '}
                            <Link 
                                href={currentView === 'signin' ? "/sign-up" : "/sign-in"} 
                                onClick={() => resetState()} 
                                className="font-semibold text-[#3F72AF] hover:text-[#112D4E] hover:underline transition-colors"
                            >
                                {currentView === 'signin' ? "Sign up" : "Sign in"}
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}