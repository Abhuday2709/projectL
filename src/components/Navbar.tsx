"use client"
import Link from 'next/link'
import { Button, buttonVariants } from './ui/button'
import { UserButton, useUser } from '@clerk/nextjs'

const Navbar = () => {
    const { isLoaded, isSignedIn } = useUser()

    if (!isLoaded) return null

    return (
        <nav className="sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-[#DBE2EF] bg-[#F9F7F7]/95 backdrop-blur-lg transition-all px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
                <Link href="/">
                    <button
                        className={`${buttonVariants({ variant: 'ghost', size: 'lg' })} ml-4 lg:ml-0 p-2 text-[#112D4E] hover:text-[#3F72AF] hover:bg-[#DBE2EF]/30 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F72AF] active:scale-95`}
                    >
                        <span className='text-xl font-bold'>PROJECT-L</span>
                    </button>
                </Link>

                <div className="flex items-center space-x-2 sm:space-x-4">
                    {!isSignedIn ? (
                        <>
                            <Link href="/sign-in">
                                <button
                                    className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} text-[#3F72AF] hover:text-[#112D4E] hover:bg-[#DBE2EF]/50 border border-[#DBE2EF] hover:border-[#3F72AF] transition-all duration-200 hover:shadow-md`}
                                >
                                    Sign in
                                </button>
                            </Link>
                            <Link href="/sign-up">
                                <button
                                    className={`${buttonVariants({ size: 'sm' })} bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95`}
                                >
                                    Register
                                </button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link

                                href="/dashboard">
                            <Button
                                className={` bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95`}
                            >
                                Dashboard
                            </Button>
                            </Link>

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
    )
}

export default Navbar