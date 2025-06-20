import { useState } from 'react';
import Dropzone from 'react-dropzone';
import { trpc } from '@/app/_trpc/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Cloud, File as FileIcon, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { ACCEPTED_MIME_TYPES } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface UploadButtonProps {
    chatId: string;
    forReview?: boolean; // <-- add this
    onUploadSuccess?: () => void;
    user_id?: string;
    createdAt?: string; 
}

const UploadButton = ({ chatId, onUploadSuccess,forReview,user_id,createdAt}: UploadButtonProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const utils = trpc.useUtils();

    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const acceptedFileTypes = ACCEPTED_MIME_TYPES;

    // Mutation for inserting into documents table
    const createDocument = trpc.documents.createDocument.useMutation({
        // Add onSuccess callback to the mutation itself
        onSuccess: async () => {
            await utils.documents.listByChat.invalidate({ chatId });
            await utils.documents.getStatus.invalidate({ chatId });
            await utils.documents.getStatus.refetch({ chatId });

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        },
        onError: (error) => {
            toast({
                title: "Document Creation Failed",
                description: error.message || "Could not save document details after upload.",
                variant: "destructive"
            });
        }
    });

    const startSimulatedProgress = () => {
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 95) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + 5;
            });
        }, 500);
        return interval;
    };

    const onDrop = async (files: File[]) => {
        if (!files[0]) return;
        
        setSelectedFile(files[0]);
        setIsUploading(true);

        const interval = startSimulatedProgress();

        try {
            
            // Create FormData
            const formData = new FormData();
            formData.append('file', files[0]);

            // Direct fetch to API route
            const response = await fetch('/api/aws/post_doc_from_chat', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Create document entry - onSuccess callback will handle refetch
            const documentData = {
                chatId,
                docId: uuidv4(),
                fileName: files[0].name,
                s3Key: result.key,
                fileType: files[0].type,
                forReview,
                user_id: user_id ,
                createdAt,
            };
            
            // This will trigger the onSuccess callback automatically
            await createDocument.mutateAsync(documentData);
            
            // Clear all document-related queries for this chat
            queryClient.removeQueries({
                queryKey: ['documents.listByChat', { chatId }]
            });
            
            // Mark all document queries as stale
            queryClient.invalidateQueries({
                queryKey: ['documents'],
                refetchType: 'all'
            });

            // Force a fresh fetch
            setTimeout(async () => {
                try {
                    await utils.documents.listByChat.refetch({ chatId });
                } catch (error) {
                    console.error('Error refetching documents:', error);
                    toast({
                        title: 'Refetch failed',
                        description: 'Could not refresh document list. Please try again later.',
                        variant: 'destructive'
                    });
                }
            }, 500);

            toast({ 
                title: 'Upload successful', 
                description: 'Your document has been uploaded and processed!' 
            });


        } catch (error) {
            console.error('❌ Upload error:', error);
        } finally {
            clearInterval(interval);
            setUploadProgress(100);
            
            // Small delay to show completion before closing
            setTimeout(() => {
                setIsUploading(false);
                setIsOpen(false);
                setSelectedFile(null);
                setUploadProgress(0);
            }, 1500);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Cloud className="w-4 h-4 mr-2" />
                        Upload Document
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileIcon className="w-5 h-5" /> Upload Document
                        </DialogTitle>
                        <DialogDescription>Select or drag & drop a Document to upload.</DialogDescription>
                    </DialogHeader>

                    <Dropzone multiple={false} accept={acceptedFileTypes} onDrop={onDrop}>
                        {(dropzoneState: import('react-dropzone').DropzoneState) => {
                            const { getRootProps, getInputProps, isDragActive, acceptedFiles } = dropzoneState;
                            return (
                                <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                    <input {...getInputProps()} />
                                    {acceptedFiles && acceptedFiles[0] ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <FileIcon className="w-4 h-4 text-blue-500" />
                                            <span className="truncate max-w-xs">{acceptedFiles[0].name}</span>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-600">
                                            {isDragActive ? 'Drop the file here...' : 'Click or drag Document here'}
                                        </p>
                                    )}
                                </div>
                            );
                        }}
                    </Dropzone>

                    {isUploading && (
                        <div className="mt-4">
                            <Progress
                                value={uploadProgress}
                                className={`h-1 ${uploadProgress === 100 ? 'bg-green-500' : ''}`}
                            />
                            {uploadProgress === 100 && (
                                <div className="flex items-center justify-center text-sm text-gray-700 pt-2">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="ghost" disabled={isUploading}>Cancel</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default UploadButton;