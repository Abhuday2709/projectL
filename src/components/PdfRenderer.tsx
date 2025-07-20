import React, { useState, useEffect, useRef } from "react";
import UploadButton from "./UploadButton";
import DocumentViewer from "./documentViewer/DocumentViewer";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    FileText,
    Download,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DocumentWithStatus } from "@/lib/utils";
/**
 * PdfRenderer React component renders a PDF document view along with upload and status management.
 *
 * @param {Object} props - The component props.
 * @param {string} props.chatId - The chat identifier used for document status fetching.
 * @param {(isViewing: boolean) => void} props.setIsViewingDocument - A callback to set if a document is being viewed.
 *
 * @returns {JSX.Element} A React component.
 *
 * @example
 * <PdfRenderer chatId="123" setIsViewingDocument={(isViewing) => console.log(isViewing)} />
 */
export default function PdfRenderer({
    chatId,
    setIsViewingDocument,
}: {
    chatId: string;
    setIsViewingDocument: (isViewing: boolean) => void;
}) {
    const { toast } = useToast();
    const [documentsWithStatus, setDocumentsWithStatus] = useState<
        DocumentWithStatus[]
    >([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    /**
     * Asynchronously fetches document statuses from the API.
     *
     * @returns {Promise<DocumentWithStatus[]>} An array of document status objects.
     *
     * @example
     * fetchStatuses().then((data) => console.log(data));
     */
    const fetchStatuses = async () => {
        try {
            const res = await fetch(
                `/api/documents/status?chatId=${encodeURIComponent(chatId)}`
            );
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = (await res.json()) as DocumentWithStatus[];
            setDocumentsWithStatus(data);
            return data;
        } catch (err: any) {
            setError(err.message);
            return [];
        }
    };

    /**
     * Manages the polling logic by starting or stopping the interval timer based on document processing status.
     *
     * @param {DocumentWithStatus[]} documents - Array of document status objects.
     *
     * @example
     * managePolling(documentsArray);
     */
    const managePolling = (documents: DocumentWithStatus[]) => {
        const anyProcessing = documents.some(
            (doc) =>
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
            setLoading(true);
            const data = await fetchStatuses();
            setLoading(false);
            managePolling(data);
        };
        start();

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [chatId]);

    // Monitor document status changes to manage polling
    useEffect(() => {
        managePolling(documentsWithStatus);
    }, [documentsWithStatus]);

    const [selectedDoc, setSelectedDoc] = useState<null | {
        fileName: string;
        s3Key: string;
    }>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<DocumentWithStatus | null>(
        null
    );

    useEffect(() => {
        if (selectedDoc && documentsWithStatus) {
            const currentSelectedDocData = documentsWithStatus.find(
                (d) => d.s3Key === selectedDoc.s3Key
            );
            if (
                currentSelectedDocData &&
                currentSelectedDocData.processingStatus !== "COMPLETED"
            ) {
                setSelectedDoc(null);
            }
        }
    }, [documentsWithStatus, selectedDoc]);
    /**
     * Constructs the document URI using the provided s3Key and environment variable.
     *
     * @param {string} s3Key - Identifier for the file in the AWS S3 bucket.
     * @returns {string} The full URL for the document.
     *
     * @throws Will throw an error if NEXT_PUBLIC_AWS_S3_BUCKET_URL is missing.
     *
     * @example
     * const uri = getDocUri("file-key-123");
     */
    const getDocUri = (s3Key: string) => {
        const base = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_URL;
        if (!base) {
            throw new Error(
                "Missing NEXT_PUBLIC_AWS_S3_BUCKET_URL in your environment variables."
            );
        }
        return `${base}/${s3Key}`;
    };
    /**
     * Deletes the provided document by making an API DELETE request.
     *
     * @param {DocumentWithStatus} doc - Document object to delete.
     *
     * @example
     * handleDelete(documentObj);
     */
    const handleDelete = async (doc: DocumentWithStatus) => {
        if (!doc.uploadedAt) return;
        setDeletingId(doc.docId);
        try {
            const res = await fetch(
                `/api/documents/${encodeURIComponent(doc.chatId)}/${encodeURIComponent(
                    doc.uploadedAt
                )}`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ s3Key: doc.s3Key, docId: doc.docId }),
                }
            );
            if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
            toast({ title: "Deleted", description: "Document deleted successfully" });
            await fetchStatuses(); // Ensure status is refreshed after deletion
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setDeletingId(null);
            setDocToDelete(null);
        }
    };

    /**
     * Handler called after a successful file upload. Refreshes the document statuses.
     *
     * @example
     * handleUploadSuccess();
     */
    const handleUploadSuccess = async () => {
        await fetchStatuses();
        // Polling will be automatically managed by the useEffect watching documentsWithStatus
    };

    const isAnyDocumentProcessing = documentsWithStatus.some(
        (doc) =>
            doc.processingStatus === "QUEUED" || doc.processingStatus === "PROCESSING"
    );
    /**
     * Returns an icon element based on the document's processing status.
     *
     * @param {DocumentWithStatus} doc - The document object.
     * @returns {JSX.Element} A react component for the respective icon.
     *
     * @example
     * const icon = getStatusIcon(documentObj);
     */
    const getStatusIcon = (doc: DocumentWithStatus) => {
        const isQueued = doc.processingStatus === "QUEUED";
        const isProcessing = doc.processingStatus === "PROCESSING";
        const isFailed = doc.processingStatus === "FAILED";
        const isCompleted = doc.processingStatus === "COMPLETED";

        if (isCompleted)
            return <CheckCircle2 size={18} className="text-green-600" />;
        if (isQueued) return <Clock size={18} className="text-amber-600" />;
        if (isProcessing)
            return (
                <Loader2 className="h-[18px] w-[18px] animate-spin text-[#3F72AF]" />
            );
        if (isFailed) return <XCircle size={18} className="text-red-600" />;
        return <AlertTriangle size={18} className="text-[#112D4E]" />;
    };

    return (
        <div className="flex-1 max-h-[85.5vh] overflow-y-auto rounded-lg h-full">
            {!selectedDoc ? (
                <div className="h-full w-full overflow-y-auto p-6">
                    {isAnyDocumentProcessing && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 mr-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 mb-1">
                                        Processing Documents
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Some documents are being processed. This may take a few
                                        moments...
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Documents
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {documentsWithStatus.length !== 0
                                            ? documentsWithStatus.length
                                            : ""}{" "}
                                        {documentsWithStatus.length === 1
                                            ? "document"
                                            : documentsWithStatus.length === 0
                                                ? "Upload your first document to get started with document analysis"
                                                : "documents"}
                                    </p>
                                </div>
                            </div>
                            <div className="">
                                <UploadButton
                                    chatId={chatId}
                                    onUploadSuccess={handleUploadSuccess}
                                />
                            </div>
                        </div>

                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex items-center gap-3 text-blue-600">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Loading documents...</span>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {documentsWithStatus.map((doc) => {
                                const isCompleted = doc.processingStatus === "COMPLETED";
                                const isFailed = doc.processingStatus === "FAILED";
                                const isProcessing =
                                    doc.processingStatus === "PROCESSING" ||
                                    doc.processingStatus === "QUEUED";

                                return (
                                    <div
                                        key={doc.docId}
                                        className={`
                                        group relative bg-white rounded-lg border transition-all duration-200 shadow-sm hover:shadow-md
                                        ${isCompleted
                                                ? "border-gray-200 hover:border-blue-500"
                                                : ""
                                            }
                                        ${isFailed
                                                ? "border-red-200 bg-red-50"
                                                : ""
                                            }
                                        ${isProcessing ? "border-gray-200" : ""}
                                    `}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-shrink-0">
                                                    <div
                                                        className={`
                                                    p-2 rounded-lg
                                                    ${isCompleted
                                                                ? "bg-green-100"
                                                                : ""
                                                            }
                                                    ${isProcessing
                                                                ? "bg-blue-100"
                                                                : ""
                                                            }
                                                    ${isFailed
                                                                ? "bg-red-100"
                                                                : ""
                                                            }
                                                `}
                                                    >
                                                        {getStatusIcon(doc)}
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <button
                                                        className={`
            text-left w-fit
            ${!isCompleted ? "cursor-not-allowed" : "cursor-pointer"}
        `}
                                                        onClick={() => {
                                                            if (isCompleted) {
                                                                setSelectedDoc({
                                                                    fileName: doc.fileName,
                                                                    s3Key: doc.s3Key,
                                                                });
                                                                setIsViewingDocument(true);
                                                            }
                                                        }}
                                                        disabled={!isCompleted}
                                                    >
                                                        <div className=" flex items-center gap-2 justify-between">
                                                            <div className="flex-1 overflow-hidden">
                                                                <h4
                                                                    className={`
        font-medium text-gray-900
        truncate max-w-56
        ${isCompleted ? "group-hover:text-blue-600" : "opacity-70"}
    `}
                                                                    title={doc.fileName}
                                                                >
                                                                    {doc.fileName}
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span
                                                                    className={`
                    inline-flex items-center px-2 py-1 rounded-md text-xs font-medium
                    ${isCompleted ? "bg-green-100 text-green-800" : ""}
                    ${isProcessing ? "bg-blue-100 text-blue-800" : ""}
                    ${isFailed ? "bg-red-100 text-red-800" : ""}
                `}
                                                                >
                                                                    {doc.processingStatus?.toLowerCase()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>

                                                {!isProcessing && (
                                                    <div className="flex-shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDocToDelete(doc);
                                                            }}
                                                            disabled={deletingId === doc.docId}
                                                            className="p-2 rounded-lg hover:bg-red-100 hover:text-red-600 text-gray-500 transition-colors"
                                                        >
                                                            {deletingId === doc.docId ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
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

            <AlertDialog
                open={!!docToDelete}
                onOpenChange={() => setDocToDelete(null)}
            >
                <AlertDialogContent className="bg-white border border-gray-200 rounded-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-gray-900 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Delete Document
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600">
                            Are you sure you want to delete{" "}
                            <span className="font-medium">"{docToDelete?.fileName}"</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="hover:bg-gray-100 text-gray-700 border-gray-300 rounded-md">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white rounded-md"
                            onClick={() => docToDelete && handleDelete(docToDelete)}
                        >
                            Delete Document
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
