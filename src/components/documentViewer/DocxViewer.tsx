import React, { useState } from 'react';
import PdfControls from './PdfControls';
import { useToast } from '@/hooks/use-toast';
import { useResizeDetector } from 'react-resize-detector';

interface DocxViewerProps {
    content: string;
    fileName: string;
    onReturn?: () => void;
    documentType: 'pdf' | 'docx' | 'unsupported';
}

const DocxViewer: React.FC<DocxViewerProps> = ({ content,fileName,onReturn,documentType }) => {
    const { toast } = useToast();
    const [numPages, setNumPages] = useState<number>();
    const [currPage, setCurrPage] = useState<number>(1);
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
    return(
    <div
        className="max-h-[70vh] rounded p-4 max-w-2xl shadow-sm border overflow-auto border-zinc-200"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC' }}
    >
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
                isDocx={true}
                content={content}
            />
        </div>
        <div
            dangerouslySetInnerHTML={{ __html: content }}
            className="prose max-w-none"
        />
    </div>
);
}

export default DocxViewer;