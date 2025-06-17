import { useState } from 'react'
import { Expand, Loader2 } from 'lucide-react'
import { Document, Page } from 'react-pdf'
import { useResizeDetector } from 'react-resize-detector'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Button } from '../ui/button'

interface PdfFullscreenProps {
    fileUrl: string
    fileName: string
    documentType: 'pdf' | 'docx' | 'unsupported'
    isDocx: boolean
    content?: string 
}

const PdfFullscreen = ({ fileUrl,fileName,documentType ,isDocx,content}: PdfFullscreenProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [numPages, setNumPages] = useState<number>()

    const { toast } = useToast()

    const { width, ref } = useResizeDetector()

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(v) => {
                if (!v) {
                    setIsOpen(v)
                }
            }}>
            <DialogTrigger
                onClick={() => setIsOpen(true)}
                asChild>
                <Button
                    variant='ghost'
                    className='gap-1.5'
                    aria-label='fullscreen'>
                    <Expand className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='max-w-4xl w-full'>
                <DialogHeader>
                    <DialogTitle>
                        <div className='flex items-center gap-3'>
                            <span className='text-lg font-semibold'>{fileName}</span>
                            <span className='px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded'>
                                {documentType.toUpperCase()}
                            </span>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                {/* Manual scrollable area, similar to PdfViewer */}
                <div
                    className="max-h-[calc(100vh-10rem)] overflow-auto border-t border-l border-r border-zinc-200"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}
                >
                    {isDocx?
                    (<div
        className="max-h-[70vh] rounded p-4 max-w-4xl shadow-sm border overflow-auto border-zinc-200"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}
    >
        <div
            dangerouslySetInnerHTML={{ __html: content||"" }}
            className="prose max-w-none"
        />
    </div>)
                    :(<div ref={ref}>
                        <Document
                            loading={
                                <div className='flex justify-center'>
                                    <Loader2 className='my-24 h-6 w-6 animate-spin' />
                                </div>
                            }
                            onLoadError={() => {
                                toast({
                                    title: 'Error loading PDF',
                                    description: 'Please try again later',
                                    variant: 'destructive',
                                })
                            }}
                            onLoadSuccess={({ numPages }) =>
                                setNumPages(numPages)
                            }
                            file={fileUrl}
                            className='max-h-full'>
                            {numPages &&
                                Array.from({ length: numPages }, (_, i) => (
                                    <Page
                                        key={i}
                                        width={width ? width : 1}
                                        pageNumber={i + 1}
                                    />
                                ))}
                        </Document>
                    </div>)}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default PdfFullscreen