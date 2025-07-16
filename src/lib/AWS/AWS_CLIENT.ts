import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
/**
 * AWS region for all clients.
 * @constant {string} REGION – The AWS region, defaulting to "ap-sounth-1" if env var missing.
 */
const REGION = process.env.NEXT_PUBLIC_AWS_REGION || "ap-sounth-1";
/**
 * S3 client for interacting with Amazon S3.
 * @export
 * @type {S3Client}
 * @requires AWS credentials in NEXT_PUBLIC_AWS_ACCESS_KEY_ID and NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
 */
export const s3Client = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ""
    }
});
/**
 * DynamoDB client for interacting with Amazon DynamoDB.
 * @export
 * @type {DynamoDBClient}
 * @requires AWS credentials in NEXT_PUBLIC_AWS_ACCESS_KEY_ID and NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
 */
export const dynamoClient = new DynamoDBClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ""
    }
});
/**
 * Lambda client for invoking AWS Lambda functions.
 * @export
 * @type {LambdaClient}
 * @requires AWS credentials in NEXT_PUBLIC_AWS_ACCESS_KEY_ID and NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
 */
export const lambdaClient = new LambdaClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ""
    }
});