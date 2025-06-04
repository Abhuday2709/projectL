import React, { useState } from "react";
import UploadButton from "./UploadButton";
import { trpc } from "../app/_trpc/client";
import DocumentViewer from "./DocumentViewer";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { Document } from "../../models/documentModel";
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

export default function PdfRenderer({ chatId }: { chatId: string }) {
    const { data: documents = [], refetch } = trpc.documents.listByChat.useQuery({ chatId });
    const [selectedDoc, setSelectedDoc] = useState<null | { fileName: string; s3Key: string }>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const { toast } = useToast();

    // Helper to build the full S3 URL
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
            refetch(); // Refresh the documents list
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

    const handleDelete = async (doc: Document) => {
        try {
            setDeletingId(doc.docId);
            const result = await deleteDocument.mutateAsync({
                chatId: doc.chatId,
                docId: doc.docId, 
                s3Key: doc.s3Key,
                uploadedAt: doc.uploadedAt,  // Include uploadedAt in the mutation
            });

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Document deleted successfully",
                });
                refetch();
            }
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

    return (
        <div className="flex-1 max-h-[calc(100vh-9rem)] min-h-[calc(100vh-9rem)] overflow-y-auto bg-zinc-50">
            {!selectedDoc ? (
                // Document List View
                <div className="w-full p-4 overflow-y-auto">
                    <UploadButton chatId={chatId} />
                    <div className="mt-4">
                        <div className="font-semibold mb-2">Documents</div>
                        <ul className="space-y-2">
                            {documents.map((doc) => (
                                <li key={doc.docId} className="flex items-center gap-2 hover:bg-gray-200">
                                    <button
                                        className="flex-1 text-left px-4 py-2 rounded flex items-center gap-2"
                                        onClick={() => setSelectedDoc({
                                            fileName: doc.fileName,
                                            s3Key: doc.s3Key
                                        })}
                                    >
                                        <span className="text-blue-500">📄</span>
                                        <span className="truncate">{doc.fileName}</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDocToDelete(doc);
                                        }}
                                        disabled={deletingId === doc.docId}
                                        className="p-2 hover:bg-red-100 transition-colors"
                                        title="Delete document"
                                    >
                                        {deletingId === doc.docId ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                // Document Viewer
                <div className="">
                    <DocumentViewer
                        url={getDocUri(selectedDoc.s3Key)}
                        fileName={selectedDoc.fileName}
                        onReturn={() => setSelectedDoc(null)}
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