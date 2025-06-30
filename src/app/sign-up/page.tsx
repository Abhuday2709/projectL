"use client"
import React, { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "../../../models/userModel";
import { isNetworkScienceEmail } from '@/lib/utils';


function Signup() {
    const { isLoaded, setActive, signUp } = useSignUp()

    const [emailAddress, setEmailAddress] = useState("")
    const [password, setPassword] = useState("")
    const [code, setCode] = useState("")
    const [pendingVerification, setPendingVerification] = useState(false)
    const [error, setError] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    const router = useRouter()

    if (!isLoaded) {
        return null;
    }

    async function Submit(e: React.FormEvent) {
        e.preventDefault()
        if (!isLoaded) {
            return;
        }

        if (!isNetworkScienceEmail(emailAddress)) {
            setError("Only @networkscience.ai email addresses are allowed to sign up.");
            return;
        }

        try {
            await signUp.create({
                emailAddress,
                password
            })
            await signUp.prepareEmailAddressVerification({
                strategy: "email_code"
            })
            setError("");
            setPendingVerification(true)
        } catch (err: unknown) {
            let message = "Sign Up failed";
            if (err instanceof Error) {
                message = err.message;
            }
            setError(message);
        }
    }
    async function onPressVerify(e: React.FormEvent) {
        e.preventDefault()
        if (!isLoaded) {
            return;
        }
        try {
            const completeSignup = await signUp.attemptEmailAddressVerification({ code })
            if (completeSignup.status !== "complete") {
                setError("That code wasn’t correct—please try again.");
                return;
            }
            if (completeSignup.status === "complete") {
                setError("");
                try {
                    const newUser: Omit<User, 'createdAt'> = {
                        user_id: completeSignup.createdUserId!,
                        email: emailAddress,
                        firstName: completeSignup.firstName || "",
                        lastName: completeSignup.lastName || "",
                    };
                    console.log("New user created:", newUser);
                    
                    const response = await fetch('/api/user/createuser', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(newUser)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || 'Failed to create user');
                    }
                } catch (dbError) {
                    console.error('Database error:', dbError);
                    setError("Account created but failed to setup user profile. Please contact support.");
                    // You might want to handle this case differently
                    return;
                }
                await setActive({ session: completeSignup.createdSessionId })
                router.push("/dashboard")
            }
        } catch (err: unknown) {
            let message = "Sign Up Verification failed";
            if (err instanceof Error) {
                message = err.message;
            }
            setError(message);
        }
    }
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">
                        Sign Up for PROJECT-L
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!pendingVerification ? (
                        <form onSubmit={Submit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    type="email"
                                    id="email"
                                    value={emailAddress}
                                    onChange={(e) => setEmailAddress(e.target.value)}
                                    placeholder="yourname@networkscience.ai"
                                    pattern=".*@networkscience\.ai$"
                                    title="Please enter a valid @networkscience.ai email address"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-gray-500" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-gray-500" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div id="clerk-captcha"></div>

                            <Button type="submit" className="w-full">
                                Sign Up
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={onPressVerify} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Verification Code</Label>
                                <Input
                                    id="code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Enter verification code"
                                    required
                                />
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button type="submit" className="w-full">
                                Verify Email
                            </Button>
                        </form>
                    )}
                </CardContent>

                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            href="/sign-in"
                            className="font-medium text-primary hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}

export default Signup