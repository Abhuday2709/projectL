import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Input } from "@/components/ui/input";
import FullscreenPdf from './FullscreenPdf';

interface PdfControlsProps {
    currPage: number;
    numPages?: number;
    onPrev: () => void;
    onNext: () => void;
    onPageSubmit: (page: number) => void;
    pageValue: string;
    setPageValue: (val: string) => void;
    errors?: { page?: string };
    fileUrl: string;
    fileName: string;
    documentType: 'pdf' | 'docx' | 'unsupported';
    onReturn?: () => void;
    isDocx: boolean;
    content?: string;
}

const PdfControls: React.FC<PdfControlsProps> = ({
    currPage,
    numPages,
    onPrev,
    onNext,
    onPageSubmit,
    pageValue,
    setPageValue,
    errors,
    fileUrl,
    fileName,
    documentType,
    onReturn,
    isDocx,
    content
}) => (
    <div className="h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2">
        <div className="flex gap-0.5">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 truncate w-32 overflow-hidden">
                    {fileName}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {documentType.toUpperCase()}
                </span>
            </div>

            {/* Navigation Controls */}
            {!isDocx && (<div className="flex items-center">
                <Button
                    disabled={currPage <= 1}
                    onClick={onPrev}
                    variant="ghost"
                    aria-label="previous page"
                >
                    <ChevronUp className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-0.5">
                    <Input
                        value={pageValue}
                        onChange={e => setPageValue(e.target.value)}
                        className={`w-12 h-8 ${errors?.page ? 'focus-visible:ring-red-500' : ''}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const num = Number(pageValue);
                                if (!isNaN(num)) onPageSubmit(num);
                            }
                        }}
                    />
                    <p className="text-zinc-700 text-sm space-x-1">
                        <span>/</span>
                        <span>{numPages ?? 'x'}</span>
                    </p>
                </div>

                <Button
                    disabled={numPages === undefined || currPage === numPages}
                    onClick={onNext}
                    variant="ghost"
                    aria-label="next page"
                >
                    <ChevronDown className="h-2 w-2" />
                </Button>
            </div>)}
        </div>
        <div className='space-x-1'>
            <FullscreenPdf fileUrl={fileUrl} fileName={fileName} documentType={documentType} isDocx={isDocx} content={content} />
            {onReturn && (
                <Button
                    onClick={onReturn}
                    variant="secondary"
                    size="sm"
                >
                    Return
                </Button>
            )}
        </div>
    </div>
);

export default PdfControls;