import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import PDF2Json from 'pdf2json';
import { promises as fs } from 'fs';
import * as path from 'path';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// Helper function to extract text from documents
export async function extractDocumentText(s3Key: string, fileType: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const buffer = await response.Body?.transformToByteArray();

    if (!buffer) {
      throw new Error('Failed to read document: Empty buffer received');
    }

    switch (fileType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        try {
          if (!buffer || !buffer.buffer) {
            throw new Error('Invalid buffer received for DOCX processing.');
          }

          const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer as ArrayBuffer });
          return result.value;
        } catch (error) {
          throw new Error(`Failed to process DOC/DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

      case 'application/pdf':
        try {
          // Generate a unique filename
          const fileName = uuidv4();
          const tempFilePath = path.join('/tmp', `${fileName}.pdf`);

          // Convert ArrayBuffer to Buffer
          const fileBuffer = Buffer.from(buffer);

          // Save the buffer as a file
          await fs.writeFile(tempFilePath, fileBuffer);

          // Create a new Promise for parsing
          const pdfParser = new (PDF2Json as any)(null, 1);

          // Create a promise to handle the parsing
          const parsingPromise = new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", (errData: any) => {
              console.error(errData.parserError);
              reject(errData.parserError); // Reject the promise on error
            });

            pdfParser.on("pdfParser_dataReady", () => {
              const parsedText = (pdfParser as any).getRawTextContent();
              resolve(parsedText); // Resolve the promise with parsed text
            });
          });

          // Load and parse the PDF
          pdfParser.loadPDF(tempFilePath);
          const parsedText = await parsingPromise; // Wait for the parsing to complete

          // Clean up the temporary file
          await fs.unlink(tempFilePath);

          return parsedText as string;
        } catch (error) {
          console.error('Error processing PDF:', {
            error,
            s3Key,
            fileType,
            details: error instanceof Error ? error.message : 'Unknown error'
          });
          throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

      default:
        console.warn('Unsupported file type:', { fileType, s3Key });
        return '';
    }
  } catch (error) {
    console.error('Document extraction error:', {
      error,
      s3Key,
      fileType,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to extract document text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 