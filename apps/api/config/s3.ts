import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { config } from './app.ts';

interface S3Config extends S3ClientConfig {
    endpoint?: string;
    forcePathStyle?: boolean;
}

export function createS3Client() {
    const s3Config: S3Config = {
        credentials: {
            accessKeyId: config.S3_ACCESS_KEY_ID,
            secretAccessKey: config.S3_SECRET_ACCESS_KEY,
        }, region: config.S3_REGION,
    };

    if (config.S3_ENDPOINT) {
        s3Config.endpoint = config.S3_ENDPOINT;
        s3Config.forcePathStyle = true;
    }

    return new S3Client(s3Config);
}

export const s3Client = createS3Client();
export const bucketName = config.S3_PRIVATE_BUCKET_NAME;
export const publicBucketName = config.S3_PUBLIC_BUCKET_NAME;
export const publicBucketUrl = config.S3_PUBLIC_URL;
