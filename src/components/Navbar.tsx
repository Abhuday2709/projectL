"use client"
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from './ui/button'
import { UserButton, useUser } from '@clerk/nextjs'
import { Loader2 } from "lucide-react";

// Main navigation component with authentication states
const Navbar = () => {
    const { isLoaded, isSignedIn } = useUser()
    const router = useRouter();
    const pathname = usePathname();
    // Controls loading state during navigation
    const [isNavLoading, setIsNavLoading] = useState(false);

    // Reset loading state on route change
    useEffect(() => {
        setIsNavLoading(false);
    }, [pathname]);

    // Handles navigation with loading state
    const handleNavigation = (targetPath: string) => {
        // If already on the target path, don't show loading
        if (pathname === targetPath) {
            return;
        }

        setIsNavLoading(true);
        router.push(targetPath);
    };

    if (!isLoaded) return null

    return (
        <>
            {isNavLoading && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
                </div>
            )}
            <nav className="sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-[#DBE2EF] bg-[#F9F7F7]/95 backdrop-blur-lg transition-all px-4 sm:px-6 lg:px-8">
                <div className="flex h-14 items-center justify-between">
                    <Button
                        className={`bg-[#DBE2EF]/0 ml-10 lg:ml-0 p-2 text-[#112D4E] hover:text-[#3F72AF] hover:bg-[#DBE2EF]/30 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F72AF] active:scale-95`}
                        onClick={() => handleNavigation("/")}
                    >
                        <span className='text-xl font-bold'>PROJECT-L</span>
                    </Button>

                    <div className="flex items-center space-x-2 sm:space-x-4">
                        {!isSignedIn ? (
                            <>
                                <Button
                                    className={`bg-[#DBE2EF]/0 text-[#3F72AF] hover:text-[#112D4E] hover:bg-[#DBE2EF]/50 hover:shadow-md border border-[#DBE2EF] hover:border-[#3F72AF] transition-all duration-200 hover:scale-105 active:scale-95`}
                                    onClick={() => handleNavigation("/sign-in")}
                                >
                                    Sign in
                                </Button>
                                <Button
                                    className={` bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95`}
                                    onClick={() => handleNavigation("/sign-up")}
                                >
                                    Register
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    className={` bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95`}
                                    onClick={() => handleNavigation("/dashboard")}
                                >
                                    Dashboard
                                </Button>

                                <UserButton
                                    appearance={{
                                        elements: {
                                            userButtonAvatarBox: 'w-8 h-8 ring-2 ring-[#DBE2EF] hover:ring-[#3F72AF] transition-all duration-200',
                                            userButtonRoot: `transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F72AF] active:scale-95`
                                        },
                                    }}
                                />
                            </>
                        )}
                    </div>
                </div>
            </nav>
        </>
    )
}

export default Navbar