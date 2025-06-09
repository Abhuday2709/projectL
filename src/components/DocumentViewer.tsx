import React, { useState, useEffect, useCallback } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
interface DocumentViewerProps {
  url: string;
  fileName: string;
  onReturn?: () => void;
}

type DocumentType =
  | 'pdf'
  | 'docx'
  | 'unsupported';

const DocumentViewer: React.FC<DocumentViewerProps> = ({ url, fileName, onReturn }) => {
  const [documentType, setDocumentType] = useState<DocumentType>('unsupported');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const getDocumentType = (url: string, fileName: string): DocumentType => {
    const ext = fileName.split('.').pop()?.toLowerCase() || url.split('.').pop()?.toLowerCase().split('?')[0];
    switch (ext) {
      case 'pdf': return 'pdf';
        case 'doc':
        case 'docx': return 'docx';
      default: return 'unsupported';
    }
  };

  const fetchDocument = async (url: string): Promise<File> => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': '*/*'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      const filename = url.split('/').pop()?.split('?')[0] || 'document';
      return new File([blob], filename, { type: blob.type });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('CORS')) {
        throw new Error('CORS error: The document URL does not allow cross-origin requests. Try using a direct file URL or a CORS-enabled server.');
      }
      throw error;
    }
  };

  const processDocument = useCallback(async (documentUrl: string, fileName: string) => {
    setLoading(true);
    setError('');

    try {
      const type = getDocumentType(documentUrl, fileName);
      setDocumentType(type);

      switch (type) {
        case 'pdf':
          setContent(documentUrl);
          break;

        case 'docx':
          try {
            const docxFile = await fetchDocument(documentUrl);
            const arrayBuffer = await docxFile.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setContent(result.value);
          } catch (err) {
            throw new Error('Failed to process DOCX file. The file may be corrupted or inaccessible.');
          }
          break;
        default:
          throw new Error('Unsupported file type');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process document');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (url && fileName) {
      processDocument(url, fileName);
    }
  }, [url, fileName, processDocument]);

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
            <p className="text-sm">Provide a document URL to view it here</p>
          </div>
        </div>
      );
    }

    switch (documentType) {
      case 'pdf':
        return (
          <iframe
            src={content}
            width="100%"
            height="470px"
            className="border rounded"
            title="PDF Document"
          />
        );
      case 'docx':
        return (
          <div className="max-h-[70vh] rounded p-6 mx-auto max-w-xl shadow-sm">
            <div 
              dangerouslySetInnerHTML={{ __html: content }}
              className="prose max-w-none"
            />
          </div>
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
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gray-50 border-b flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700 truncate">{fileName}</span>
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
              {documentType.toUpperCase()}
            </span>
          </div>
          {onReturn && (
            <button
              onClick={onReturn}
              className="px-4 py-2 bg-gray-200 shadow-lg hover:bg-gray-100 rounded-md flex items-center"
            >
              <span>Return</span>
            </button>
          )}
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default DocumentViewer;