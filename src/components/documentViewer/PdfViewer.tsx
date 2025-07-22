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
/**  
 * PdfViewer component  
 * Renders a PDF document with navigation controls.  
 * @param props.content - The URL or base64 string of the PDF document.  
 * @param props.fileName - The name of the document.  
 * @param props.onReturn - Optional callback when returning from fullscreen.  
 * @param props.documentType - The type of document ("pdf", "docx", or "unsupported").  
 * @returns JSX.Element representing the PDF viewer.  
 * @example <PdfViewer content="someUrl" fileName="document.pdf" documentType="pdf" />
 */
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

    /**  
     * Cleanup function to cancel ongoing tasks.  
     * Calls destroy/cleanup on document and page refs if available.  
     */
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
    /**  
     * Callback invoked when the document loads successfully.  
     * Sets the total number of pages and updates loading state.  
     * @param param0.numPages - Total pages in the PDF document.  
     */
    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setIsLoading(false);
    };
    /**  
     * Callback invoked on document load error.  
     * Displays an error toast unless it is a cancellation error.  
     * @param error - The error object from PDF loading.  
     */
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
    /**  
     * Callback for page render errors.  
     * Suppresses known cancellation/abort errors.  
     * @param error - The error object from page rendering.  
     */
    const handlePageRenderError = (error: any) => {
        // Suppress AbortException and cancellation errors
        if (error?.message?.includes('cancelled') ||
            error?.message?.includes('abort') ||
            error?.name === 'AbortException') {
            return; // Don't log these errors
        }
        console.warn('Page render error:', error);
    };
    /**  
    * Navigate to the previous page.  
    * Decrements the current page ensuring it's not less than 1.  
    */
    const onPrev = () => {
        const newPage = currPage - 1 > 1 ? currPage - 1 : 1;
        setCurrPage(newPage);
        setPageValue(String(newPage));
    };
    /**  
     * Navigate to the next page.  
     * Increments the current page up to the total number of pages.  
     */
    const onNext = () => {
        if (numPages !== undefined) {
            const newPage = currPage + 1 > numPages ? numPages : currPage + 1;
            setCurrPage(newPage);
            setPageValue(String(newPage));
        }
    };
    /**  
     * Sets the current page from a manual input.  
     * Validates against page boundaries.  
     * @param num - The desired page number.  
     */
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
        <div className="w-full bg-white rounded-md shadow flex flex-col items-center h-[62.5vh]">
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
            <div className="flex-1 w-full max-h-[60vh]">
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