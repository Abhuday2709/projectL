import React, { useState, useEffect, useRef } from "react";
import UploadButton from "./UploadButton";
import DocumentViewer from "./documentViewer/DocumentViewer";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Download } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DocumentWithStatus } from "@/lib/utils";

export default function PdfRenderer({ chatId, setIsViewingDocument, isClient = false }: { chatId: string, setIsViewingDocument: (isViewing: boolean) => void, isClient?: boolean }) {
    const { toast } = useToast();
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<DocumentWithStatus | null>(null);

    console.log("documentsWithStatus", documentsWithStatus);

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

    const handleDelete = async (doc: DocumentWithStatus) => {
        if (!doc.uploadedAt) return
        setDeletingId(doc.docId)
        try {
            const res = await fetch(
                `/api/documents/${encodeURIComponent(doc.chatId)}/${encodeURIComponent(doc.uploadedAt)}`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ s3Key: doc.s3Key, docId: doc.docId }),
                }
            )
            if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`)
            toast({ title: 'Deleted', description: 'Document deleted successfully' })
            await fetchStatuses() // Ensure status is refreshed after deletion
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' })
        } finally {
            setDeletingId(null)
            setDocToDelete(null)
        }
    }

    // Enhanced upload success handler
    const handleUploadSuccess = async () => {
        await fetchStatuses();
        // Polling will be automatically managed by the useEffect watching documentsWithStatus
    };

    const isAnyDocumentProcessing = documentsWithStatus.some(
        doc => doc.processingStatus === 'QUEUED' || doc.processingStatus === 'PROCESSING'
    );

    const getStatusColor = (status: string | undefined) => {
        switch (status) {
            case 'COMPLETED':
                return 'text-[#3F72AF]';
            case 'PROCESSING':
                return 'text-[#3F72AF]';
            case 'QUEUED':
                return 'text-[#112D4E]';
            case 'FAILED':
                return 'text-red-500';
            default:
                return 'text-[#112D4E]';
        }
    };

    const getStatusBg = (status: string | undefined) => {
        switch (status) {
            case 'COMPLETED':
                return 'bg-[#DBE2EF]';
            case 'PROCESSING':
                return 'bg-[#DBE2EF]';
            case 'QUEUED':
                return 'bg-[#F9F7F7]';
            case 'FAILED':
                return 'bg-red-50';
            default:
                return 'bg-[#F9F7F7]';
        }
    };

    const getStatusIcon = (doc: DocumentWithStatus) => {
        const isQueued = doc.processingStatus === 'QUEUED';
        const isProcessing = doc.processingStatus === 'PROCESSING';
        const isFailed = doc.processingStatus === 'FAILED';
        const isCompleted = doc.processingStatus === 'COMPLETED';

        if (isCompleted) return <CheckCircle2 size={20} className="text-[#3F72AF]" />;
        if (isQueued) return <Clock size={20} className="text-[#112D4E]" />;
        if (isProcessing) return <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF]" />;
        if (isFailed) return <XCircle size={20} className="text-red-500" />;
        return <AlertTriangle size={20} className="text-[#112D4E]" />;
    };

    return (
        <div className="flex-1 max-h-[71.5vh] overflow-y-auto bg-[#F9F7F7] rounded-lg h-full">
            {!selectedDoc ? (
                <div className="w-full overflow-y-auto">
                    {!isClient &&
                        <UploadButton chatId={chatId} onUploadSuccess={handleUploadSuccess} />}
                    {isAnyDocumentProcessing && (
                        <div className="my-4 p-4 bg-[#DBE2EF] border-l-4 border-[#3F72AF] rounded-r-lg shadow-sm">
                            <div className="flex items-center">
                                <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF] mr-3" />
                                <div>
                                    <p className="font-medium text-[#112D4E]">Processing Documents</p>
                                    <p className="text-sm text-[#3F72AF]">Some documents are being processed. Please wait...</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="h-6 w-6 text-[#3F72AF]" />
                            <h3 className="text-xl font-semibold text-[#112D4E]">Documents</h3>
                            <span className="bg-[#DBE2EF] text-[#3F72AF] px-3 py-1 rounded-full text-sm font-medium">
                                {documentsWithStatus.length}
                            </span>
                        </div>

                        {documentsWithStatus.length === 0 && !loading && (
                            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-[#DBE2EF]">
                                <FileText className="h-12 w-12 text-[#DBE2EF] mx-auto mb-4" />
                                <p className="text-[#3F72AF] text-lg font-medium mb-2">No documents uploaded yet</p>
                                <p className="text-[#112D4E] opacity-70">Click the upload button above to add your first document</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {documentsWithStatus.map((doc: DocumentWithStatus) => {
                                const isQueued = doc.processingStatus === 'QUEUED';
                                const isProcessing = doc.processingStatus === 'PROCESSING';
                                const isFailed = doc.processingStatus === 'FAILED';
                                const isCompleted = doc.processingStatus === 'COMPLETED';

                                return (
                                    <div
                                        key={doc.docId}
                                        className={`
                                            group relative bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200
                                            ${isCompleted ? 'border-[#DBE2EF] hover:border-[#3F72AF]' : ''}
                                            ${isFailed ? 'border-red-200 bg-red-50' : ''}
                                            ${(isQueued || isProcessing) ? 'border-[#DBE2EF]' : ''}
                                        `}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-shrink-0">
                                                    {getStatusIcon(doc)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <button
                                                        className={`
                                                            w-full text-left group-hover:text-[#3F72AF] transition-colors duration-200
                                                            ${!isCompleted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                                                        `}
                                                        onClick={() => {
                                                            if (isCompleted) {
                                                                setSelectedDoc({ fileName: doc.fileName, s3Key: doc.s3Key });
                                                                setIsViewingDocument(true);
                                                            }
                                                        }}
                                                        disabled={!isCompleted}
                                                        title={isCompleted ? `Click to view ${doc.fileName}` : `Status: ${doc.processingStatus}`}
                                                    >
                                                        <h4 className="font-medium text-[#112D4E] truncate mb-1">
                                                            {doc.fileName}
                                                        </h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`
                                                                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                                ${getStatusBg(doc.processingStatus)} ${getStatusColor(doc.processingStatus)}
                                                            `}>
                                                                {doc.processingStatus?.toLowerCase()}
                                                            </span>
                                                            {(isProcessing || isQueued) && (
                                                                <span className="text-xs text-[#3F72AF] opacity-70">
                                                                    Processing...
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                </div>

                                                {!(isQueued || isProcessing) && (
                                                    <div className="flex-shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDocToDelete(doc);
                                                            }}
                                                            disabled={deletingId === doc.docId || isProcessing}
                                                            className={`
                                                                p-2 rounded-lg transition-all duration-200
                                                                ${isProcessing
                                                                    ? 'cursor-not-allowed opacity-50'
                                                                    : 'hover:bg-red-50 hover:text-red-600 text-gray-400'
                                                                }
                                                            `}
                                                            title={isProcessing ? "Cannot delete while processing" : "Delete document"}
                                                        >
                                                            {deletingId === doc.docId ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {isFailed && doc.processingError && (
                                                <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-700 font-medium mb-1">Processing Failed</p>
                                                    <p className="text-xs text-red-600 opacity-80">
                                                        Please delete this document and try uploading again
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <DocumentViewer url={getDocUri(selectedDoc.s3Key)} fileName={selectedDoc.fileName} onReturn={() => { setSelectedDoc(null); setIsViewingDocument(false); }} />
            )}
            <AlertDialog open={!!docToDelete} onOpenChange={() => setDocToDelete(null)}>
                <AlertDialogContent className="bg-[#F9F7F7] border-[#DBE2EF]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[#112D4E]">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-[#3F72AF]">This will permanently delete "{docToDelete?.fileName}" and remove it from our servers.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={() => docToDelete && handleDelete(docToDelete)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}