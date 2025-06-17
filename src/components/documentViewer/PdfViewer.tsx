import React, { useState } from 'react';
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

const PdfViewer: React.FC<PdfViewerProps> = ({ content ,fileName,onReturn,documentType}) => {
    const { toast } = useToast();
    const [numPages, setNumPages] = useState<number>();
    const [currPage, setCurrPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [renderedScale, setRenderedScale] = useState<number | null>(null);
    const { width, ref } = useResizeDetector();
    const isLoading = renderedScale !== scale;
    const [pageValue, setPageValue] = useState<string>('1');
    const [errors, setErrors] = useState<{ page?: string }>({});

    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const handleDocumentLoadError = () => {
        toast({ title: 'Error loading PDF', description: 'Please try again later', variant: 'destructive' });
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
                fileUrl = {content}
                fileName = {fileName}
                documentType = {documentType}
                onReturn={onReturn}
                isDocx={false}
            />
            <div className="flex-1 w-full max-h-screen">
                <div className="max-h-[63vh] overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}>
                    <div ref={ref}>
                        <Document
                            loading={
                                <div className="flex justify-center">
                                    <Loader2 className="my-24 h-6 w-6 animate-spin" />
                                </div>
                            }
                            onLoadError={handleDocumentLoadError}
                            onLoadSuccess={handleDocumentLoadSuccess}
                            file={content}
                            className="max-h-full"
                        >
                            {isLoading && renderedScale ? (
                                <Page width={width || 1} pageNumber={currPage} scale={scale} rotate={rotation} key={'@' + renderedScale} />
                            ) : null}

                            <Page
                                className={isLoading ? 'hidden' : ''}
                                width={width || 1}
                                pageNumber={currPage}
                                scale={scale}
                                rotate={rotation}
                                key={'@' + scale}
                                loading={
                                    <div className="flex justify-center">
                                        <Loader2 className="my-24 h-6 w-6 animate-spin" />
                                    </div>
                                }
                                onRenderSuccess={() => setRenderedScale(scale)}
                            />
                        </Document>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfViewer;