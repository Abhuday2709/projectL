"use client"
import Link from 'next/link'
import { buttonVariants } from './ui/button'
import { UserButton, useUser } from '@clerk/nextjs'

const Navbar = () => {
    const { isLoaded, isSignedIn } = useUser()

    if (!isLoaded) return null

    return (
        <nav className="sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-zinc-300 bg-gray-100 backdrop-blur-lg transition-all px-5">
            <div className="flex h-14 items-center justify-between border-b border-zinc-300">
                <Link
                    href="/">
                    <button
                        className={`${buttonVariants({ variant: 'ghost', size: 'lg' })} p-2 transition-transform duration-150 ease-in-outhover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 active:scale-95`}
                    >
                        <span className='text-xl'>PROJECT-L</span>
                    </button>
                </Link>


                <div className="hidden items-center space-x-4 sm:flex">
                    {!isSignedIn ? (
                        <>
                            <Link href="/sign-in">
                                <button
                                    className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} p-2 transition-transform duration-150 ease-in-outhover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500active:scale-95`}
                                >
                                    Sign in
                                </button>
                            </Link>
                            <Link href="/sign-up">
                                <button
                                    className={`${buttonVariants({ size: 'sm' })} text-whitetransition-transform duration-150 ease-in-out hover:bg-blue-800 hover:scale-105focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900active:scale-95`}
                                >
                                    Register
                                </button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/dashboard"
                                className={`${buttonVariants({ size: 'sm' })} text-whitetransition-transform duration-150 ease-in-out hover:bg-blue-800 hover:scale-105focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900active:scale-95`}
                            >
                                Dashboard
                            </Link>

                            <UserButton
                                afterSignOutUrl="/"
                                appearance={{
                                    // size the avatar box
                                    elements: {
                                        userButtonAvatarBox: 'w-8 h-8',
                                        // style the outer trigger element
                                        userButtonRoot: `transition-transform duration-150 ease-in-outhover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500active:scale-95
            `
                                    },
                                }}
                            />
                        </>
                    )}
                </div>

            </div>
        </nav>
    )
}

export default Navbar