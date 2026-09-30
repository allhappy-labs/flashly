import { type Router, route } from '@better-upload/server';
import { aws, custom } from '@better-upload/server/clients';
import { bucketName, publicBucketName } from './s3.ts';
import { config } from './app.ts';

const endpointUrl = config.S3_ENDPOINT ? new URL(config.S3_ENDPOINT) : null;

const uploadClient = endpointUrl
    ? custom({
          host: endpointUrl.host,
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          region: config.S3_REGION,
          secure: endpointUrl.protocol === 'https:',
          forcePathStyle: true,
      })
    : aws({
          accessKeyId: config.S3_ACCESS_KEY_ID,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          region: config.S3_REGION,
      });

// Unified upload router with declarative configuration
export const uploadRouter: Router = {
    client: uploadClient,
    bucketName, // Default to private bucket
    routes: {
        avatar: route({
            multipleFiles: false,
            maxFileSize: 1024 * 1024 * 2, // 2MB
            fileTypes: ['image/jpeg', 'image/png', 'image/webp'],
            onBeforeUpload: async ({ file }) => {
                return {
                    bucketName: publicBucketName, // Use public bucket for avatars
                    generateObjectInfo: () => ({
                        key: `avatars/${crypto.randomUUID()}-${file.name}`,
                    }),
                };
            },
        }),
        documents: route({
            // Uses default private bucket
            multipleFiles: false,
            maxFileSize: 1024 * 1024 * 25, // 25MB
            fileTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
            onBeforeUpload: async ({ file }) => {
                return {
                    bucketName, // Ensure using private bucket for documents
                    generateObjectInfo: () => ({
                        key: `documents/${crypto.randomUUID()}-${file.name}`,
                    }),
                };
            },
        }),
    },
};
