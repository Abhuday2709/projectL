"use client"
import React, { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Mail, Lock, Shield, CheckCircle, Loader2, MessageSquare, Headphones, Share, BarChart3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User } from "@/models/userModel";
import { isNetworkScienceEmail } from '@/lib/utils';
import bcrypt from "bcryptjs";

function Signup() {
    const { isLoaded, setActive, signUp } = useSignUp()

    const [emailAddress, setEmailAddress] = useState("")
    const [password, setPassword] = useState("")
    const [code, setCode] = useState("")
    const [pendingVerification, setPendingVerification] = useState(false)
    const [error, setError] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const router = useRouter()

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F9F7F7]">
                <Loader2 className="h-12 w-12 animate-spin text-[#3F72AF]" />
            </div>
        );
    }

    async function Submit(e: React.FormEvent) {
        e.preventDefault()
        if (!isLoaded) return;

        if (!isNetworkScienceEmail(emailAddress)) {
            setError("Only @networkscience.ai email addresses are allowed to sign up.");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            await signUp.create({
                emailAddress,
                password
            })
            await signUp.prepareEmailAddressVerification({
                strategy: "email_code"
            })
            setPendingVerification(true)
        } catch (err: any) {
            setError(err.errors?.[0]?.message || "Sign up failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    async function onPressVerify(e: React.FormEvent) {
        e.preventDefault()
        if (!isLoaded) return;

        setIsLoading(true);
        setError("");
        try {
            const completeSignup = await signUp.attemptEmailAddressVerification({ code })
            if (completeSignup.status !== "complete") {
                setError("Verification failed. Please check the code and try again.");
                return;
            }
            
            const passwordHash = await bcrypt.hash(password, 10);
            
            const newUser: Omit<User, 'createdAt'> = {
                user_id: completeSignup.createdUserId!,
                email: emailAddress,
                firstName: completeSignup.firstName || "",
                lastName: completeSignup.lastName || "",
                passwordHash: passwordHash,
            };
            
            const response = await fetch('/api/user/createUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create user profile.');
            }

            await setActive({ session: completeSignup.createdSessionId })
            router.push("/dashboard")

        } catch (err: any) {
            const dbError = err.message?.includes('user profile');
            setError(dbError ? err.message : (err.errors?.[0]?.message || "Verification failed. Please try again."));
        } finally {
            setIsLoading(false);
        }
    }

    return ( 
        <div className="h-[calc(100vh-3.5rem)] bg-[#F9F7F7] flex items-center justify-center px-4 py-12">
            {/* Left Side - Information */}
            <div className="hidden lg:block w-full max-w-md">
                <Card className="h-full bg-gradient-to-br from-[#112D4E] to-[#3F72AF] text-white border-none shadow-lg rounded-r-none">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">PROJECT-L Features</CardTitle>
                        <CardDescription className="text-blue-100">
                            AI-powered document intelligence platform
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <MessageSquare className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Smart Chat</h4>
                                <p className="text-xs text-blue-100">Interactive document conversations</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Headphones className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">AI Podcasts</h4>
                                <p className="text-xs text-blue-100">Audio summaries of your content</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <Share className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Secure Sharing</h4>
                                <p className="text-xs text-blue-100">Password-protected client links</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm">Smart Reviews</h4>
                                <p className="text-xs text-blue-100">Automated document evaluation</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <div className="w-full p-3 bg-white/10 rounded-lg border border-white/20 text-center">
                            <p className="text-xs text-blue-100">
                                "Perfect for business analysis and client collaboration"
                            </p>
                        </div>
                    </CardFooter>
                </Card>
            </div>

            {/* Right Side - Sign Up Form */}
            <div className="w-full max-w-md">
                <Card className="shadow-lg border-[#DBE2EF] rounded-l-none">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-[#112D4E]">
                            Join PROJECT-L
                        </CardTitle>
                        <CardDescription className="text-[#112D4E]/70">
                            Create your secure account to continue
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!pendingVerification ? (
                            <form onSubmit={Submit} className="space-y-4">
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
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button 
                                    type="submit" 
                                    className="w-full bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Create Account
                                </Button>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <Alert className="border-[#DBE2EF]">
                                    <Mail className="h-4 w-4 text-[#3F72AF]" />
                                    <AlertTitle className="text-[#112D4E]">Check your email</AlertTitle>
                                    <AlertDescription className="text-[#112D4E]/70">
                                        We've sent a verification code to <span className="font-semibold text-[#3F72AF]">{emailAddress}</span>.
                                    </AlertDescription>
                                </Alert>

                                <form onSubmit={onPressVerify} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="text-[#112D4E]">Verification Code</Label>
                                        <Input
                                            id="code"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            placeholder="Enter 6-digit code"
                                            className="text-center tracking-[0.5em] border-[#DBE2EF] focus:border-[#3F72AF]"
                                            maxLength={6}
                                            required
                                            disabled={isLoading}
                                        />
                                    </div>

                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <Button 
                                        type="submit" 
                                        className="w-full bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" 
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        Verify Account
                                    </Button>
                                </form>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="justify-center">
                        <p className="text-sm text-[#112D4E]/70">
                            Already have an account?{" "}
                            <Link href="/sign-in" className="font-semibold text-[#3F72AF] hover:text-[#112D4E] hover:underline transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export default Signup;