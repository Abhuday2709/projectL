"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, FileText, Search, Loader2 } from "lucide-react"; // Add Loader2

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Listen for route changes to hide loader
    useEffect(() => {
        setIsLoading(false);
    }, [router]);

    const handleRouteChange = (path: string) => {
        setIsLoading(true);
        router.push(path);
        setIsOpen(false);
    };

    const isActiveRoute = (path: string) => {
        // For the main dashboard route, highlight sendProposals
        if (pathname === '/dashboard') {
            return path === '/dashboard/sendProposals';
        }

        // For sendProposals and its dynamic routes
        if (path === '/dashboard/sendProposals') {
            return pathname === path || pathname.startsWith(`${path}/`);
        }

        // For bid-nobid page and its dynamic routes
        if (path === '/dashboard/bid-nobid') {
            return pathname === path || pathname.startsWith(`${path}/`);
        }

        // For other routes, match exactly
        return pathname === path;
    };

    const linkClasses = (path: string) =>
        `group flex items-center py-3 px-4 rounded-lg transition-all duration-200 cursor-pointer hover:scale-[1.02] ${isActiveRoute(path)
            ? "bg-[#3F72AF] text-white shadow-md hover:bg-[#112D4E] hover:shadow-lg"
            : "text-[#112D4E] hover:text-[#3F72AF] hover:bg-[#DBE2EF]/30"
        }`;

    const iconClasses = (path: string) =>
        `w-5 h-5 mr-3 transition-all duration-200 ${isActiveRoute(path)
            ? "text-white"
            : "text-[#3F72AF] group-hover:text-[#3F72AF]"
        }`;

    return (
        <>
            {/* Loader Overlay */}
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
                </div>
            )}

            {/* Enhanced Hamburger menu icon for small screens */}
            <div className="lg:hidden fixed top-7 transform -translate-y-1/2 left-4 z-[45]">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2.5 rounded-full text-[#112D4E] bg-[#F9F7F7]/80 backdrop-blur-sm border border-transparent hover:border-[#DBE2EF] shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F72AF] active:scale-95 transition-all duration-200"
                    aria-label="Toggle menu"
                >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                        <Menu
                            size={20}
                            className={`absolute transition-all duration-300 ease-in-out ${isOpen ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`}
                        />
                        <X
                            size={20}
                            className={`absolute transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}
                        />
                    </div>
                </button>
            </div>

            {/* Overlay when sidebar is open on small screens */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-[#112D4E]/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] w-64 px-4 bg-[#F9F7F7]/95 backdrop-blur-sm shadow-lg overflow-y-auto border-r border-[#DBE2EF] z-50
                transform ${isOpen ? "translate-x-0" : "-translate-x-full"}
                lg:translate-x-0 transition-transform duration-300 ease-in-out`}
            >
                {/* Sidebar Header */}
                <div className="py-6 border-b border-[#DBE2EF]/50">
                    <h2 className="text-lg font-semibold text-[#112D4E] px-4">Dashboard</h2>
                    <p className="text-sm text-[#112D4E]/60 px-4 mt-1">Manage your documents</p>
                </div>

                {/* Navigation */}
                <nav className="space-y-2 mt-6 pb-6">
                    <div
                        onClick={() => handleRouteChange('/dashboard/sendProposals')}
                        className={linkClasses("/dashboard/sendProposals")}
                    >
                        <FileText className={iconClasses("/dashboard/sendProposals")} />
                        <span className="font-medium">Send Proposals</span>
                    </div>

                    <div
                        onClick={() => handleRouteChange('/dashboard/bid-nobid')}
                        className={linkClasses("/dashboard/bid-nobid")}
                    >
                        <Search className={iconClasses("/dashboard/bid-nobid")} />
                        <span className="font-medium">Bid/No Bid</span>
                    </div>
                    <div
                        onClick={() => handleRouteChange('/dashboard/adminDashboard')}
                        className={linkClasses("/dashboard/adminDashboard")}
                    >
                        <Search className={iconClasses("/dashboard/adminDashboard")} />
                        <span className="font-medium">Admin Dashboard</span>
                    </div>
                    <div
                        onClick={() => handleRouteChange('/dashboard/userManagement')}
                        className={linkClasses("/dashboard/userManagement")}
                    >
                        <Search className={iconClasses("/dashboard/userManagement")} />
                        <span className="font-medium">User Management</span>
                    </div>
                </nav>

                {/* Sidebar Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#F9F7F7] to-transparent">
                    <div className="text-xs text-[#112D4E]/50 text-center">
                        PROJECT-L Dashboard
                    </div>
                </div>
            </aside>
        </>
    );
}