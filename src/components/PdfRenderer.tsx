import React, { useState, useEffect } from "react";
import UploadButton from "./UploadButton";
import { trpc } from "../app/_trpc/client";
import DocumentViewer from "./documentViewer/DocumentViewer";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import type { DocumentWithStatus } from "../trpc/procedures/document/getDocumentProcessingStatus";
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

export default function PdfRenderer({ chatId, setIsViewingDocument }: { chatId: string, setIsViewingDocument: (isViewing: boolean) => void }) {
    const {
        data: documentsWithStatus = [],
        refetch: refetchDocumentStatuses,
        isLoading: isLoadingStatuses
    } = trpc.documents.getStatus.useQuery(
        { chatId },
        {
            refetchInterval: (query) => {
                const data = query.state.data;
                if (Array.isArray(data)) {
                    const isAnyProcessing = data.some(
                        (doc: DocumentWithStatus) => doc.processingStatus === 'QUEUED' || doc.processingStatus === 'PROCESSING'
                    );
                    return isAnyProcessing ? 5000 : false;
                }
                return false;
            },
            refetchOnWindowFocus: true,
        }
    );

    const [selectedDoc, setSelectedDoc] = useState<null | { fileName: string; s3Key: string }>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<DocumentWithStatus | null>(null);
    const { toast } = useToast();
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

    const deleteDocument = trpc.documents.delete.useMutation({
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Document deleted successfully",
            });
            refetchDocumentStatuses();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
        onSettled: () => {
            setDeletingId(null);
        },
    });

    const handleDelete = async (doc: DocumentWithStatus) => {
        if (!doc.uploadedAt) {
            toast({
                title: "Error",
                description: "Cannot delete document: missing upload date.",
                variant: "destructive",
            });
            setDeletingId(null);
            setDocToDelete(null);
            return;
        }
        try {
            setDeletingId(doc.docId);
            await deleteDocument.mutateAsync({
                chatId: doc.chatId,
                docId: doc.docId,
                s3Key: doc.s3Key,
                uploadedAt: doc.uploadedAt,
            });
        } catch (error: any) {
            console.error('Error deleting document:', error);
            toast({
                title: "Error",
                description: error?.message || "Failed to delete document. Please try again.",
                variant: "destructive",
            });
        } finally {
            setDeletingId(null);
            setDocToDelete(null);
        }
    };
    const isAnyDocumentProcessing = documentsWithStatus.some(
        doc => doc.processingStatus === 'QUEUED' || doc.processingStatus === 'PROCESSING'
    );

    return (
        <div className="flex-1 max-h-[71.5vh] overflow-y-auto bg-white rounded-lg">
            {!selectedDoc ? (
                <div className="w-full p-4 overflow-y-auto">
                    <UploadButton chatId={chatId} onUploadSuccess={refetchDocumentStatuses} />
                    {isAnyDocumentProcessing && (
                        <div className="my-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Some documents are being processed. Please wait...
                        </div>
                    )}
                    <div className="mt-4">
                        <div className="font-semibold mb-2">Documents</div>
                        {/*isLoadingStatuses && documentsWithStatus.length === 0 && (
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                            <p className="ml-2 text-zinc-500">Loading documents...</p>
                        </div>
                    )*/}
                        {documentsWithStatus.length === 0 && !isLoadingStatuses && (
                            <p className="text-zinc-500">No documents uploaded yet. Click above to add some!</p>
                        )}
                        <ul className="space-y-1">
                            {documentsWithStatus.map((doc: DocumentWithStatus) => {
                                const isQueued = doc.processingStatus === 'QUEUED';
                                const isProcessing = doc.processingStatus === 'PROCESSING';
                                const isFailed = doc.processingStatus === 'FAILED';
                                const isCompleted = doc.processingStatus === 'COMPLETED';

                                return (
                                    <li key={doc.docId} className={`flex items-center gap-1 p-1 rounded ${isCompleted ? 'hover:bg-gray-200' : ''} ${isFailed ? 'bg-red-50' : ''}`}>
                                        <button
                                            className={`flex-1 text-left px-2 py-1.5 rounded flex items-center gap-2 ${!isCompleted ? 'cursor-not-allowed opacity-70' : ''}`}
                                            onClick={() => {
                                                if (isCompleted) {
                                                    setSelectedDoc({ fileName: doc.fileName, s3Key: doc.s3Key });
                                                    setIsViewingDocument(true);
                                                }
                                            }}
                                            disabled={!isCompleted}
                                            title={isCompleted ? doc.fileName : `Status: ${doc.processingStatus}`}
                                        >
                                            {isCompleted && <span className="text-green-500"><CheckCircle2 size={18} /></span>}
                                            {isQueued && <span className="text-yellow-500"><Clock size={18} /></span>}
                                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                            {isFailed && <span className="text-red-500"><XCircle size={18} /></span>}
                                            {!isCompleted && !isProcessing && !isFailed && !isQueued && <span className="text-yellow-500"><AlertTriangle size={18} /></span>}
                                            <span className="truncate flex-1">{doc.fileName}</span>
                                            {isProcessing && <span className="text-xs text-blue-600 ml-auto">({doc.processingStatus?.toLowerCase()})</span>}
                                            {isQueued && <span className="text-xs text-yellow-600 ml-auto">({doc.processingStatus?.toLowerCase()})</span>}
                                            {isFailed && <span className="text-xs text-red-600 ml-auto">(failed)</span>}
                                        </button>
                                        {!(isQueued || isProcessing) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDocToDelete(doc);
                                                }}
                                                disabled={deletingId === doc.docId || isProcessing}
                                                className={`p-1.5 rounded hover:bg-red-100 transition-colors ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
                                                title={isProcessing ? "Cannot delete while processing" : "Delete document"}
                                            >
                                                {deletingId === doc.docId ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                )}
                                            </button>)}
                                        {isFailed && doc.processingError && (
                                            <p className="text-xs text-red-500 w-full pl-8 truncate" title={doc.processingError}>Error: {doc.processingError}</p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="">
                    <DocumentViewer
                        url={getDocUri(selectedDoc.s3Key)}
                        fileName={selectedDoc.fileName}
                        onReturn={() => {
                            setSelectedDoc(null);
                            setIsViewingDocument(false);
                        }}
                    />
                </div>
            )}
            <AlertDialog open={!!docToDelete} onOpenChange={() => setDocToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{docToDelete?.fileName}" and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => docToDelete && handleDelete(docToDelete)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}