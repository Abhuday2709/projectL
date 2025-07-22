import React, { useState } from 'react';
import PdfControls from './PdfControls';
import { useToast } from '@/hooks/use-toast';

interface DocxViewerProps {
    content: string;
    fileName: string;
    onReturn?: () => void;
    documentType: 'pdf' | 'docx' | 'unsupported';
}
/**  
 * DocxViewer component  
 * Renders DOCX content as HTML along with PDF-like navigation controls.  
 * @param props.content - Converted HTML content from the DOCX file.  
 * @param props.fileName - Name of the document file.  
 * @param props.onReturn - Optional callback to return from the viewer.  
 * @param props.documentType - Document type (should be "docx").  
 * @returns JSX.Element displaying the DOCX content with controls.  
 * @example <DocxViewer content="htmlContent" fileName="document.docx" documentType="docx" />
 */
const DocxViewer: React.FC<DocxViewerProps> = ({ content, fileName, onReturn, documentType }) => {
    const { toast } = useToast();
    const [numPages, setNumPages] = useState<number>();
    const [currPage, setCurrPage] = useState<number>(1);
    const [pageValue, setPageValue] = useState<string>('1');
    const [errors, setErrors] = useState<{ page?: string }>({});
    /**  
     * Navigate to the previous page.  
     * Decrements current page ensuring it doesn't fall below 1.  
     */
    const onPrev = () => {
        const newPage = currPage - 1 > 1 ? currPage - 1 : 1;
        setCurrPage(newPage);
        setPageValue(String(newPage));
    };
    /**  
     * Navigate to the next page.  
     * Increments current page up to the total number of pages.  
     */
    const onNext = () => {
        if (numPages !== undefined) {
            const newPage = currPage + 1 > numPages ? numPages : currPage + 1;
            setCurrPage(newPage);
            setPageValue(String(newPage));
        }
    };
    /**  
     * Sets the current page from user input  
     * Validates the page number against the total pages.  
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
        <div
            className="max-h-[60vh] rounded p-4 max-w-2xl shadow-sm border overflow-auto border-zinc-200"
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
                    fileUrl={content}
                    fileName={fileName}
                    documentType={documentType}
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