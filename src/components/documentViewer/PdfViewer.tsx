import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import { useResizeDetector } from 'react-resize-detector';
import PdfControls from './PdfControls';
import { useToast } from '@/hooks/use-toast';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
    content: string;
    fileName: string;
    onReturn?: () => void;
    documentType: 'pdf' | 'docx' | 'unsupported';
}

const PdfViewer: React.FC<PdfViewerProps> = ({ content, fileName, onReturn, documentType }) => {
    const { toast } = useToast();
    const [numPages, setNumPages] = useState<number>();
    const [currPage, setCurrPage] = useState<number>(1);
    const { width, ref } = useResizeDetector();
    const [pageValue, setPageValue] = useState<string>('1');
    const [errors, setErrors] = useState<{ page?: string }>({});
    const [isLoading, setIsLoading] = useState(true);
    const documentRef = useRef<any>(null);
    const pageRef = useRef<any>(null);

    // Memoize the options object to prevent unnecessary reloads
    const documentOptions = useMemo(() => ({
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
    }), []);

    // Cleanup function to cancel ongoing tasks
    const cleanupTasks = () => {
        if (documentRef.current) {
            try {
                documentRef.current.destroy();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        if (pageRef.current) {
            try {
                pageRef.current.cleanup();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    };

    useEffect(() => {
        return () => {
            cleanupTasks();
        };
    }, []);

    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setIsLoading(false);
    };

    const handleDocumentLoadError = (error: any) => {
        // Only show toast if it's not a cancellation error
        if (!error?.message?.includes('cancelled') && !error?.message?.includes('abort')) {
            toast({ 
                title: 'Error loading PDF', 
                description: 'Please try again later', 
                variant: 'destructive' 
            });
        }
        setIsLoading(false);
    };

    const handlePageRenderError = (error: any) => {
        // Suppress AbortException and cancellation errors
        if (error?.message?.includes('cancelled') || 
            error?.message?.includes('abort') ||
            error?.name === 'AbortException') {
            return; // Don't log these errors
        }
        console.warn('Page render error:', error);
    };

    const onPrev = () => {
        const newPage = currPage - 1 > 1 ? currPage - 1 : 1;
        setCurrPage(newPage);
        setPageValue(String(newPage));
    };

    const onNext = () => {
        if (numPages !== undefined) {
            const newPage = currPage + 1 > numPages ? numPages : currPage + 1;
            setCurrPage(newPage);
            setPageValue(String(newPage));
        }
    };

    const onPageSubmit = (num: number) => {
        if (numPages && (num < 1 || num > numPages)) {
            setErrors({ page: 'Invalid page' });
        } else {
            setCurrPage(num);
            setPageValue(String(num));
            setErrors({});
        }
    };

    return (
        <div className="w-full bg-white rounded-md shadow flex flex-col items-center h-full">
            <PdfControls
                currPage={currPage}
                numPages={numPages}
                onPrev={onPrev}
                onNext={onNext}
                onPageSubmit={onPageSubmit}
                pageValue={pageValue}
                setPageValue={setPageValue}
                errors={errors}
                fileUrl={content}
                fileName={fileName}
                documentType={documentType}
                onReturn={onReturn}
                isDocx={false}
            />
            <div className="flex-1 w-full max-h-screen">
                <div className="max-h-[60vh] overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}>
                    <div ref={ref}>
                        <Document
                            ref={documentRef}
                            loading={
                                <div className="flex justify-center">
                                    <Loader2 className="my-24 h-6 w-6 animate-spin" />
                                </div>
                            }
                            onLoadError={handleDocumentLoadError}
                            onLoadSuccess={handleDocumentLoadSuccess}
                            file={content}
                            className="max-h-full"
                            options={documentOptions}
                        >
                            <Page
                                width={width || 1}
                                pageNumber={currPage}
                                key={`page_${currPage}`}
                                loading={
                                    <div className="flex justify-center">
                                        <Loader2 className="my-24 h-6 w-6 animate-spin" />
                                    </div>
                                }
                                onRenderError={handlePageRenderError}
                                renderTextLayer={true}
                                renderAnnotationLayer={false}
                            />
                        </Document>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfViewer;