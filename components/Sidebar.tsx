"use client";

import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const isActiveRoute = (path: string) => {
        // For the main dashboard route, highlight sendProposals
        if (pathname === '/dashboard') {
            return path === '/dashboard/sendProposals';
        }

        // For sendProposals and its dynamic routes
        if (path === '/dashboard/sendProposals') {
            return pathname === path || pathname.startsWith(`${path}/`);
        }

        // For temp page and its dynamic routes
        if (path === '/dashboard/temp') {
            return pathname === path || pathname.startsWith(`${path}/`);
        }

        // For other routes, match exactly
        return pathname === path;
    };

    const linkClasses = (path: string) =>
        `block py-2.5 px-4 rounded transition duration-200 hover:bg-blue-600 cursor-pointer ${
            isActiveRoute(path) ? "bg-blue-700 text-white" : "text-black"
        }`;

    return (
        <aside className="fixed left-0 h-screen w-64 px-5 bg-gray-100 text-white shadow-md overflow-y-auto border-r border-zinc-300">
            <nav className="space-y-2 mt-10">
                <div
                    onClick={() => router.push('/dashboard/sendProposals')}
                    className={linkClasses("/dashboard/sendProposals")}
                >
                    Send Proposals
                </div>
                <div
                    onClick={() => router.push('/dashboard/temp')}
                    className={linkClasses("/dashboard/temp")}
                >
                    Temp Page
                </div>
            </nav>
        </aside>
    );
}