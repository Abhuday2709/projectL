import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

// Reusable wrapper component that provides consistent max-width and padding
// Used to maintain consistent content width across different sections
const MaxWidthWrapper = ({
    className,// Optional CSS classes to extend styling
    children,// Child components to be wrapped
}: {
    className?: string
    children: ReactNode
}) => {
    return (
        <div className={cn('mx-auto w-full max-w-screen-xl px-2.5 md:px-20', className)}>
            {children}
        </div>
    )
}

export default MaxWidthWrapper