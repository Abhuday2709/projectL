
'use client'
import { useState } from 'react';
import Dropzone from 'react-dropzone';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTrigger,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Cloud, File as FileIcon, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { ACCEPTED_MIME_TYPES } from '@/lib/utils';

interface UploadButtonProps {
    chatId: string;
    forReview?: boolean;
    onUploadSuccess?: () => void;
    user_id?: string;
    createdAt?: string;
}
/**
 * Button and dialog to upload a document file to S3 and create a document record.
 * @param {string} props.chatId - ID of the chat session.
 * @param {boolean} [props.forReview] - Flag if the document is for review.
 * @param {() => void} [props.onUploadSuccess] - Callback after successful upload.
 * @param {string} [props.user_id] - ID of the uploading user.
 * @param {string} [props.createdAt] - Creation timestamp string.
 * @returns JSX.Element - Upload button and modal dialog.
 * @usage
 * <UploadButton chatId="abc123" onUploadSuccess={() => refreshList()} />
 */
const UploadButton = ({ chatId, onUploadSuccess, forReview, user_id, createdAt }: UploadButtonProps) => {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const acceptedFileTypes = ACCEPTED_MIME_TYPES;
    /**
     * Simulate progress bar updates until real upload completes.
     * @returns {NodeJS.Timeout} - Interval ID for clearing.
     */
    const startSimulatedProgress = () => {
        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress((prev) => (prev >= 95 ? prev : prev + 5));
        }, 500);
        return interval;
    };
    /**
     * Handle file drop/upload and record creation.
     * @param {File[]} files - Array of dropped files (only first used).
     */
    const onDrop = async (files: File[]) => {
        if (!files[0]) return;

        setSelectedFile(files[0]);
        setIsUploading(true);
        const interval = startSimulatedProgress();

        try {
            // Upload to S3 via your API route
            const formData = new FormData();
            formData.append('file', files[0]);

            const uploadRes = await fetch('/api/aws/post_doc_from_chat', {
                method: 'POST',
                body: formData,
            });
            if (!uploadRes.ok) {
                throw new Error(`Upload failed: ${uploadRes.statusText}`);
            }
            const { key } = await uploadRes.json();

            // Create document record
            const documentData = {
                chatId,
                docId: uuidv4(),
                fileName: files[0].name,
                s3Key: key,
                fileType: files[0].type,
                forReview,
                user_id,
                createdAt,
            };

            const createRes = await fetch('/api/documents/createDocument', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(documentData),
            });
            if (!createRes.ok) {
                const err = await createRes.json();
                throw new Error(err.message || 'Document creation failed');
            }

            // Optionally refetch parent document list/status
            if (onUploadSuccess) onUploadSuccess();

            toast({ title: 'Upload successful', description: 'Your document is being processed.' });
        } catch (error: any) {
            console.error('Upload error:', error);
            toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
        } finally {
            clearInterval(interval);
            setUploadProgress(100);
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
                    <Button className=" bg-[#3F72AF] hover:bg-[#112D4E] text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95">
                        <Cloud className="w-4 h-4 mr-2" />
                        Upload Document
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileIcon className="w-5 h-5" /> Upload Document
                        </DialogTitle>
                        <DialogDescription>Select or drag & drop a document to upload.</DialogDescription>
                    </DialogHeader>

                    <Dropzone multiple={false} accept={acceptedFileTypes} onDrop={onDrop}>
                        {({ getRootProps, getInputProps, isDragActive, acceptedFiles }) => (
                            <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                                <input {...getInputProps()} />
                                {acceptedFiles[0] ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <FileIcon className="w-4 h-4 text-blue-500" />
                                        <span className="truncate max-w-xs">{acceptedFiles[0].name}</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600">
                                        {isDragActive ? 'Drop the file here...' : 'Click or drag document here'}
                                    </p>
                                )}
                            </div>
                        )}
                    </Dropzone>

                    {isUploading && (
                        <div className="mt-4">
                            <Progress value={uploadProgress} className={`h-1 ${uploadProgress === 100 ? 'bg-green-500' : ''}`} />
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
