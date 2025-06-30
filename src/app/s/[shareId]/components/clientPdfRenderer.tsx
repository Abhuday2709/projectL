import React, { useState, useEffect, useRef } from "react";
import DocumentViewer from "@/components/documentViewer/DocumentViewer";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, FileText } from "lucide-react";
import { DocumentWithStatus } from "@/lib/utils";

export default function ClientPdfRenderer({ chatId, setIsViewingDocument }: { chatId: string, setIsViewingDocument: (isViewing: boolean) => void }) {
    const [documentsWithStatus, setDocumentsWithStatus] = useState<DocumentWithStatus[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchStatuses = async () => {
        try {
            const res = await fetch(`/api/documents/status?chatId=${encodeURIComponent(chatId)}`)
            if (!res.ok) throw new Error(`Error ${res.status}`)
            const data = await res.json() as DocumentWithStatus[]
            setDocumentsWithStatus(data)
            return data
        } catch (err: any) {
            setError(err.message)
            return []
        }
    }

    // Separate function to manage polling
    const managePolling = (documents: DocumentWithStatus[]) => {
        const anyProcessing = documents.some(
            doc =>
                typeof doc.processingStatus === "string" &&
                ["QUEUED", "PROCESSING"].includes(doc.processingStatus)
        );

        if (anyProcessing && !intervalRef.current) {
            // Start polling if not already running
            intervalRef.current = setInterval(fetchStatuses, 5000);
        } else if (!anyProcessing && intervalRef.current) {
            // Stop polling if no documents are processing
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        const start = async () => {
            setLoading(true)
            const data = await fetchStatuses()
            setLoading(false)
            managePolling(data);
        }
        start()

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null;
            }
        }
    }, [chatId])

    // Monitor document status changes to manage polling
    useEffect(() => {
        managePolling(documentsWithStatus);
    }, [documentsWithStatus]);

    const [selectedDoc, setSelectedDoc] = useState<null | { fileName: string; s3Key: string }>(null);

    useEffect(() => {
        if (selectedDoc && documentsWithStatus) {
            const currentSelectedDocData = documentsWithStatus.find(d => d.s3Key === selectedDoc.s3Key);
            if (currentSelectedDocData && currentSelectedDocData.processingStatus !== 'COMPLETED') {
                setSelectedDoc(null);
            }
        }
    }, [documentsWithStatus, selectedDoc]);

    const getDocUri = (s3Key: string) => {
        const base = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;
        if (!base) {
            throw new Error("Missing NEXT_PUBLIC_AWS_S3_BUCKET_URL in your environment variables.");
        }
        return `${base}/${s3Key}`;
    };

    const isAnyDocumentProcessing = documentsWithStatus.some(
        doc => doc.processingStatus === 'QUEUED' || doc.processingStatus === 'PROCESSING'
    );

    const getStatusIcon = (doc: DocumentWithStatus) => {
        const isQueued = doc.processingStatus === 'QUEUED';
        const isProcessing = doc.processingStatus === 'PROCESSING';
        const isFailed = doc.processingStatus === 'FAILED';
        const isCompleted = doc.processingStatus === 'COMPLETED';

        if (isCompleted) return <CheckCircle2 size={18} className="text-green-600" />;
        if (isQueued) return <Clock size={18} className="text-amber-600" />;
        if (isProcessing) return <Loader2 className="h-[18px] w-[18px] animate-spin text-[#3F72AF]" />;
        if (isFailed) return <XCircle size={18} className="text-red-600" />;
        return <AlertTriangle size={18} className="text-[#112D4E]" />;
    };

    return (
        <div className="flex-1 max-h-[71.5vh] overflow-y-auto rounded-lg h-full">
            {!selectedDoc ? (
                <div className="w-full overflow-y-auto p-6">
                    {isAnyDocumentProcessing && (
                        <div className="mb-6 p-4 bg-[#DBE2EF] border border-[#3F72AF] rounded-lg">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 mr-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#3F72AF]" />
                                </div>
                                <div>
                                    <p className="font-semibold text-[#112D4E] mb-1">Processing Documents</p>
                                    <p className="text-sm text-[#3F72AF]">Some documents are being processed. This may take a few moments...</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#DBE2EF] rounded-lg">
                                    <FileText className="h-5 w-5 text-[#3F72AF]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[#112D4E]">Documents</h3>
                                    <p className="text-sm text-[#3F72AF]">
                                        {documentsWithStatus.length} {documentsWithStatus.length === 1 ? 'document' : 'documents'}
                                    </p>
                                </div>
                            </div>
                            {documentsWithStatus.length > 0 && (
                                <div className="px-3 py-1 bg-[#DBE2EF] text-[#112D4E] rounded-full text-sm font-medium">
                                    {documentsWithStatus.filter(doc => doc.processingStatus === 'COMPLETED').length} ready
                                </div>
                            )}
                        </div>

                        {documentsWithStatus.length === 0 && !loading && (
                            <div className="text-center py-16 bg-white rounded-lg border border-[#DBE2EF] shadow-sm">
                                <div className="max-w-sm mx-auto">
                                    <div className="mb-4">
                                        <div className="mx-auto w-16 h-16 bg-[#DBE2EF] rounded-full flex items-center justify-center">
                                            <FileText className="h-8 w-8 text-[#3F72AF]" />
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-medium text-[#112D4E] mb-2">No documents yet</h4>
                                    <p className="text-[#3F72AF] text-sm leading-relaxed">
                                        Documents will appear here once uploaded by the admin.
                                    </p>
                                </div>
                            </div>
                        )}

                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex items-center gap-3 text-[#3F72AF]">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Loading documents...</span>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {documentsWithStatus.map((doc) => {
                                const isCompleted = doc.processingStatus === 'COMPLETED';
                                const isFailed = doc.processingStatus === 'FAILED';
                                const isProcessing = doc.processingStatus === 'PROCESSING' || doc.processingStatus === 'QUEUED';

                                return (
                                    <div
                                        key={doc.docId}
                                        className={`
                                        group relative bg-white rounded-lg border transition-all duration-200 shadow-sm hover:shadow-md
                                        ${isCompleted ? 'border-[#DBE2EF] hover:border-[#3F72AF]' : ''}
                                        ${isFailed ? 'border-red-200 bg-red-50' : ''}
                                        ${isProcessing ? 'border-[#DBE2EF]' : ''}
                                    `}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-shrink-0">
                                                    <div className={`
                                                    p-2 rounded-lg
                                                    ${isCompleted ? 'bg-[#DBE2EF]' : ''}
                                                    ${isProcessing ? 'bg-[#F9F7F7]' : ''}
                                                    ${isFailed ? 'bg-red-100' : ''}
                                                `}>
                                                        {getStatusIcon(doc)}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <button
                                                        className={`
                                                        w-full text-left
                                                        ${!isCompleted ? 'cursor-not-allowed' : 'cursor-pointer'}
                                                    `}
                                                        onClick={() => {
                                                            if (isCompleted) {
                                                                setSelectedDoc({ fileName: doc.fileName, s3Key: doc.s3Key });
                                                                setIsViewingDocument(true);
                                                            }
                                                        }}
                                                        disabled={!isCompleted}
                                                    >
                                                        <h4 className={`
                                                        font-medium text-[#112D4E] truncate mb-2
                                                        ${isCompleted ? 'group-hover:text-[#3F72AF]' : 'opacity-70'}
                                                    `}>
                                                            {doc.fileName}
                                                        </h4>

                                                        <div className="flex items-center gap-2">
                                                            <span className={`
                                                            inline-flex items-center px-2 py-1 rounded-md text-xs font-medium
                                                            ${isCompleted ? 'bg-[#DBE2EF] text-[#112D4E]' : ''}
                                                            ${isProcessing ? 'bg-[#F9F7F7] text-[#3F72AF]' : ''}
                                                            ${isFailed ? 'bg-red-100 text-red-800' : ''}
                                                        `}>
                                                                {doc.processingStatus?.toLowerCase()}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <DocumentViewer
                    url={getDocUri(selectedDoc.s3Key)}
                    fileName={selectedDoc.fileName}
                    onReturn={() => {
                        setSelectedDoc(null);
                        setIsViewingDocument(false);
                    }}
                />
            )}
        </div>
    );
}