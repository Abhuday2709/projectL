import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
import * as mammoth from 'mammoth';
import PdfViewer from './PdfViewer';
import DocxViewer from './DocxViewer';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface DocumentViewerProps {
    url: string;
    fileName: string;
    onReturn?: () => void;
}

type DocumentType = 'pdf' | 'docx' | 'unsupported';
/**  
 * DocumentViewer component  
 * Loads and renders a document based on its type (PDF, DOCX, or unsupported).  
 * @param props.url - URL of the document.  
 * @param props.fileName - The name of the document file.  
 * @param props.onReturn - Optional callback when returning from the viewer.  
 * @returns JSX.Element displaying the document viewer UI.  
 * @example <DocumentViewer url="docUrl" fileName="doc.pdf" />
 */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ url, fileName, onReturn }) => {
    const [documentType, setDocumentType] = useState<DocumentType>('unsupported');
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const processedUrlRef = useRef<string>('');
    const isMountedRef = useRef(true);

    const CustomPageValidator = z.object({ page: z.string().refine((num) => Number(num) > 0 && Number(num) <= (1)) });
    const { formState: { errors }, setValue } = useForm({
        defaultValues: { page: '1' },
        resolver: zodResolver(CustomPageValidator)
    });

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    /**  
     * Determines the document type based on file extension.  
     * @param url - URL of the document.  
     * @param fileName - Name of the document file.  
     * @returns DocumentType ("pdf", "docx", or "unsupported").  
     */
    const getDocumentType = (url: string, fileName: string): DocumentType => {
        const ext = fileName.split('.').pop()?.toLowerCase() || url.split('.').pop()?.toLowerCase().split('?')[0];
        switch (ext) {
            case 'pdf': return 'pdf';
            case 'doc':
            case 'docx': return 'docx';
            default: return 'unsupported';
        }
    };
    /**  
     * Fetches the document from the provided URL and returns it as a File object.  
     * @param url - The URL of the document.  
     * @returns A Promise resolving to a File object.  
     * @throws Error with CORS or fetch failure messages.  
     */
    const fetchDocument = async (url: string): Promise<File> => {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                headers: { 'Accept': '*/*' },
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });
            if (!response.ok) throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
            const blob = await response.blob();
            const filename = url.split('/').pop()?.split('?')[0] || 'document';
            return new File([blob], filename, { type: blob.type });
        } catch (err) {
            if (err instanceof TypeError && (err as Error).message.includes('CORS')) {
                throw new Error('CORS error: The document URL does not allow cross-origin requests. Try using a direct file URL or a CORS-enabled server.');
            }
            throw err;
        }
    };
    /**  
     * Processes the document based on its URL and fileName.  
     * Determines document type and retrieves content accordingly.
     * @param documentUrl - The URL of the document.
     * @param fileName - The document file name.
     */
    const processDocument = useCallback(async (documentUrl: string, fileName: string) => {
        // Prevent processing the same URL multiple times
        if (processedUrlRef.current === documentUrl) {
            return;
        }

        processedUrlRef.current = documentUrl;
        setLoading(true);
        setError('');
        setValue('page', '1');

        try {
            const type = getDocumentType(documentUrl, fileName);

            if (!isMountedRef.current) return;
            setDocumentType(type);

            switch (type) {
                case 'pdf':
                    if (isMountedRef.current) {
                        setContent(documentUrl);
                    }
                    break;
                case 'docx': {
                    const docxFile = await fetchDocument(documentUrl);
                    if (!isMountedRef.current) return;

                    const arrayBuffer = await docxFile.arrayBuffer();
                    if (!isMountedRef.current) return;

                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (isMountedRef.current) {
                        setContent(result.value);
                    }
                    break;
                }
                default:
                    throw new Error('Unsupported file type');
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to process document');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [setValue]);

    useEffect(() => {
        if (url && fileName) {
            processDocument(url, fileName);
        }

        return () => {
            // Reset processed URL when component unmounts or URL changes
            processedUrlRef.current = '';
        };
    }, [url, fileName, processDocument]);
    /**  
     * Renders the document content based on loading, error, and type.  
     * @returns JSX.Element containing the document viewer UI.
     */
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-600">Loading document...</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center justify-center h-64 text-red-500">
                    <AlertCircle className="w-8 h-8 mr-2" />
                    <div className="text-center">
                        <div className="font-medium">Error loading document</div>
                        <div className="text-sm text-red-400 mt-1">{error}</div>
                    </div>
                </div>
            );
        }
        if (!content) {
            return (
                <div className="flex items-center justify-center h-64 text-gray-500">
                    <FileText className="w-12 h-12 mr-4" />
                    <div className="text-center">
                        <h3 className="text-lg font-medium">No document loaded</h3>
                        <p className="text-sm">Upload a document to view it here</p>
                    </div>
                </div>
            );
        }

        switch (documentType) {
            case 'pdf':
                return (
                    <PdfViewer
                        key={`pdf-${url}`} // Add key to force re-mount when URL changes
                        content={content}
                        fileName={fileName}
                        documentType={documentType}
                        onReturn={onReturn}
                    />
                );
            case 'docx':
                return (
                    <DocxViewer
                        key={`docx-${url}`} // Add key to force re-mount when URL changes
                        content={content}
                        fileName={fileName}
                        documentType={documentType}
                        onReturn={onReturn}
                    />
                );
            default:
                return (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                        <AlertCircle className="w-8 h-8 mr-2" />
                        <div className="text-center">
                            <div className="font-medium">Unsupported document type</div>
                            <div className="text-sm mt-1">This file format is not supported for viewing</div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="h-[30vh] flex flex-col bg-white rounded-lg shadow-lg">
            <div className={documentType === 'pdf' ? '' : 'overflow-auto flex-1'}>
                {renderContent()}
            </div>
        </div>
    );
};

export default DocumentViewer;