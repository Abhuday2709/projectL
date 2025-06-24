"use client"
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    setShowLoader(false);
  }, [router]);
  return (
    <>
      {showLoader && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
        </div>
      )}
      <div className="bg-[#F9F7F7] min-h-screen">
        <MaxWidthWrapper className='mb-12 mt-24 sm:mt-40 flex flex-col items-center justify-center text-center'>
          <div className='mx-auto mb-4 flex max-w-fit items-center justify-center space-x-2 overflow-hidden rounded-full border border-[#DBE2EF] bg-white px-7 py-2 shadow-md backdrop-blur transition-all hover:border-[#3F72AF] hover:bg-[#DBE2EF]/30'>
            <p className='text-sm font-semibold text-[#112D4E]'>
              PROJECT-L is now live!
            </p>
          </div>
          <h1 className='max-w-4xl text-5xl font-bold md:text-6xl lg:text-7xl text-[#112D4E]'>
            Transform your{' '}
            <span className='text-[#3F72AF]'>documents</span>{' '}
            into intelligent insights.
          </h1>
          <p className='mt-5 max-w-prose text-[#112D4E]/70 sm:text-lg'>
            Chat with documents, generate podcasts, create secure client shares,
            and get AI-powered evaluations. Your complete document intelligence platform.
          </p>

          <Button
            onClick={() => {
              setShowLoader(true);
              router.push('/dashboard');
            }}
            className={`
            ${buttonVariants({ size: 'lg' })} mt-5
            bg-[#3F72AF] hover:bg-[#112D4E]
            text-white border-0
            transition-all duration-200
            hover:scale-105 hover:shadow-lg
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F72AF]
            active:scale-95
          `}
          >
            Get Started
          </Button>
        </MaxWidthWrapper>

        {/* value proposition section */}
        <div>
          <div className='relative isolate'>
            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80'>
              <div
                style={{
                  clipPath:
                    'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                }}
                className='relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#DBE2EF] to-[#3F72AF] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]'
              />
            </div>

            <div>
              <div className='mx-auto max-w-6xl px-6 lg:px-8'>
                <div className='mt-16 flow-root sm:mt-24'>
                  <div className='-m-2 rounded-xl bg-[#112D4E]/5 p-2 ring-1 ring-inset ring-[#DBE2EF] lg:-m-4 lg:rounded-2xl lg:p-4'>
                    <Image
                      src='/chatDoc.png'
                      alt='product preview'
                      width={1364}
                      height={866}
                      quality={100}
                      className='rounded-md bg-white p-2 sm:p-8 md:p-20 shadow-2xl ring-1 ring-[#DBE2EF]'
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80'>
              <div
                style={{
                  clipPath:
                    'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                }}
                className='relative left-[calc(50%-13rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#DBE2EF] to-[#3F72AF] opacity-30 sm:left-[calc(50%-36rem)] sm:w-[72.1875rem]'
              />
            </div>
          </div>
        </div>

        {/* Features Overview */}
        <div className='mx-auto mb-16 mt-32 max-w-5xl sm:mt-56'>
          <div className='mb-12 px-6 lg:px-8'>
            <div className='mx-auto max-w-2xl sm:text-center'>
              <h2 className='mt-2 font-bold text-4xl text-[#112D4E] sm:text-5xl'>
                Four powerful features in one platform
              </h2>
              <p className='mt-4 text-lg text-[#112D4E]/70'>
                Everything you need to unlock the potential of your documents.
              </p>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 px-6 lg:px-8">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-6 py-8 bg-white ring-1 ring-[#DBE2EF] rounded-lg leading-none flex flex-col space-y-4 hover:shadow-lg transition-all duration-200">
                <div className="w-12 h-12 bg-[#DBE2EF] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#3F72AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#112D4E]">Smart Chat</h3>
                <p className="text-[#112D4E]/70 text-sm">Upload multiple documents and have intelligent conversations with your content instantly.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#112D4E] to-[#3F72AF] rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-6 py-8 bg-white ring-1 ring-[#DBE2EF] rounded-lg leading-none flex flex-col space-y-4 hover:shadow-lg transition-all duration-200">
                <div className="w-12 h-12 bg-[#DBE2EF] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#3F72AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#112D4E]">AI Podcasts</h3>
                <p className="text-[#112D4E]/70 text-sm">Generate audio podcast summaries of your documents for easy listening and sharing.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#3F72AF] to-[#DBE2EF] rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-6 py-8 bg-white ring-1 ring-[#DBE2EF] rounded-lg leading-none flex flex-col space-y-4 hover:shadow-lg transition-all duration-200">
                <div className="w-12 h-12 bg-[#DBE2EF] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#3F72AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#112D4E]">Secure Sharing</h3>
                <p className="text-[#112D4E]/70 text-sm">Create password-protected links for clients and track their interactions with your documents.</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#DBE2EF] to-[#112D4E] rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-6 py-8 bg-white ring-1 ring-[#DBE2EF] rounded-lg leading-none flex flex-col space-y-4 hover:shadow-lg transition-all duration-200">
                <div className="w-12 h-12 bg-[#DBE2EF] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#3F72AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#112D4E]">Smart Reviews</h3>
                <p className="text-[#112D4E]/70 text-sm">Evaluate documents with custom question sets and get scored assessments with visual insights.</p>
              </div>
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className='mx-auto mb-32 mt-16 max-w-5xl'>
          <div className='mb-12 px-6 lg:px-8'>
            <div className='mx-auto max-w-2xl sm:text-center'>
              <h2 className='mt-2 font-bold text-4xl text-[#112D4E] sm:text-5xl'>
                Get started in minutes
              </h2>
              <p className='mt-4 text-lg text-[#112D4E]/70'>
                From upload to insights in just a few simple steps.
              </p>
            </div>
          </div>

          {/* steps */}
          <ol className="mx-8 my-8 space-y-4 pt-8 md:flex md:space-x-12 md:space-y-0">
            <li className="md:flex-1">
              <div className="flex flex-col space-y-2 border-l-4 border-[#DBE2EF] py-2 pl-4 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-[#3F72AF]">
                  Step 1
                </span>
                <span className="text-xl font-semibold text-[#112D4E]">
                  Create your workspace
                </span>
                <span className="mt-2 text-[#112D4E]/70">
                  Sign up and create a new chat or review session to organize your documents.
                </span>
              </div>
            </li>
            <li className="md:flex-1">
              <div className="flex flex-col space-y-2 border-l-4 border-[#DBE2EF] py-2 pl-4 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-[#3F72AF]">
                  Step 2
                </span>
                <span className="text-xl font-semibold text-[#112D4E]">
                  Upload documents
                </span>
                <span className="mt-2 text-[#112D4E]/70">
                  Drag & drop multiple PDF files. Our AI processes them instantly for analysis.
                </span>
              </div>
            </li>
            <li className="md:flex-1">
              <div className="flex flex-col space-y-2 border-l-4 border-[#DBE2EF] py-2 pl-4 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-[#3F72AF]">
                  Step 3
                </span>
                <span className="text-xl font-semibold text-[#112D4E]">
                  Choose your workflow
                </span>
                <span className="mt-2 text-[#112D4E]/70">
                  Chat with documents, generate podcasts, create reviews, or share with clients.
                </span>
              </div>
            </li>
            <li className="md:flex-1">
              <div className="flex flex-col space-y-2 border-l-4 border-[#DBE2EF] py-2 pl-4 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-4">
                <span className="text-sm font-medium text-[#3F72AF]">
                  Step 4
                </span>
                <span className="text-xl font-semibold text-[#112D4E]">
                  Get intelligent insights
                </span>
                <span className="mt-2 text-[#112D4E]/70">
                  Receive AI-powered answers, scores, recommendations, and shareable content.
                </span>
              </div>
            </li>
          </ol>

          <div className='mx-auto max-w-6xl px-6 lg:px-8 mt-16'>
            <div className='mt-16 flow-root sm:mt-24'>
              <div className='-m-2 rounded-xl bg-[#112D4E]/5 p-2 ring-1 ring-inset ring-[#DBE2EF] lg:-m-4 lg:rounded-2xl lg:p-4'>
                <Image
                  src='/reviewDoc.png'
                  alt='platform preview'
                  width={1364}
                  height={732}
                  quality={100}
                  className='rounded-md bg-white p-2 sm:p-8 md:p-20 shadow-2xl ring-1 ring-[#DBE2EF]'
                />
              </div>
            </div>
          </div>
        </div>

        {/* Use Cases Section */}
        <div className='mx-auto mb-32 mt-16 max-w-5xl px-6 lg:px-8'>
          <div className='mb-12'>
            <div className='mx-auto max-w-2xl sm:text-center'>
              <h2 className='mt-2 font-bold text-4xl text-[#112D4E] sm:text-5xl'>
                Perfect for every workflow
              </h2>
              <p className='mt-4 text-lg text-[#112D4E]/70'>
                Whether you're evaluating proposals, sharing insights, or analyzing documents, PROJECT-L adapts to your needs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-[#DBE2EF] hover:shadow-md hover:border-[#3F72AF] transition-all duration-200">
              <h3 className="text-lg font-semibold text-[#112D4E] mb-3">Business Analysis</h3>
              <p className="text-[#112D4E]/70 text-sm mb-4">Evaluate proposals, business plans, and investment opportunities with structured assessments and scoring.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">Due Diligence</span>
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">RFP Analysis</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-[#DBE2EF] hover:shadow-md hover:border-[#3F72AF] transition-all duration-200">
              <h3 className="text-lg font-semibold text-[#112D4E] mb-3">Client Collaboration</h3>
              <p className="text-[#112D4E]/70 text-sm mb-4">Share documents securely with clients, track their questions, and provide podcast summaries.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">Client Portals</span>
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">Secure Sharing</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-[#DBE2EF] hover:shadow-md hover:border-[#3F72AF] transition-all duration-200">
              <h3 className="text-lg font-semibold text-[#112D4E] mb-3">Research & Analysis</h3>
              <p className="text-[#112D4E]/70 text-sm mb-4">Process research documents, create interactive Q&A sessions, and generate accessible audio content.</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">Research</span>
                <span className="px-2 py-1 bg-[#DBE2EF] text-[#3F72AF] text-xs rounded">Content Creation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}