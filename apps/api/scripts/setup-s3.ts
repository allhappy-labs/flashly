import {
    CreateBucketCommand,
    GetBucketCorsCommand,
    GetBucketPolicyCommand,
    HeadBucketCommand,
    PutBucketCorsCommand,
    PutBucketPolicyCommand,
    S3Client,
} from '@aws-sdk/client-s3';

// Load environment variables
const S3_REGION = process.env.S3_REGION;
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_ADMIN_ACCESS_KEY_ID = process.env.S3_ADMIN_ACCESS_KEY_ID;
const S3_ADMIN_SECRET_KEY = process.env.S3_ADMIN_SECRET_KEY;
const PRIVATE_BUCKET_NAME = process.env.S3_PRIVATE_BUCKET_NAME;
const PUBLIC_BUCKET_NAME = process.env.S3_PUBLIC_BUCKET_NAME;

// Create S3Client for admin operations (bucket creation, policy management)
const adminS3Client = new S3Client({
    credentials: {
        accessKeyId: S3_ADMIN_ACCESS_KEY_ID!,
        secretAccessKey: S3_ADMIN_SECRET_KEY!,
    }, endpoint: S3_ENDPOINT, forcePathStyle: true, region: S3_REGION, // Required for Scaleway
});

// Create S3Client for regular application operations (to validate app credentials)
const appS3Client = new S3Client({
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
    }, endpoint: S3_ENDPOINT, forcePathStyle: true, region: S3_REGION, // Required for Scaleway
});

// CORS configuration for both buckets
const corsConfiguration = {
    CORSRules: [
        {
            AllowedHeaders: ['*'], AllowedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'], AllowedOrigins: [
                'http://localhost:3000', // Frontend development
                'http://localhost:3001', // API development
                // Add production domains here when needed
                // 'https://yourdomain.com',
            ], ExposeHeaders: ['ETag', 'x-amz-server-side-encryption'], MaxAgeSeconds: 3000,
        },
    ],
};

async function checkBucketExists(bucketName: string): Promise<boolean> {
    try {
        await adminS3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return true;
    } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
            return false;
        }
        throw error;
    }
}

async function setupPrivateBucket() {
    console.log('\n📦 Setting up PRIVATE bucket for documents and sensitive files...');
    console.log(`   Bucket name: ${PRIVATE_BUCKET_NAME}`);

    try {
        // Check if bucket exists
        const exists = await checkBucketExists(PRIVATE_BUCKET_NAME!);

        if (!exists) {
            console.log('Creating new private bucket...');
            await adminS3Client.send(new CreateBucketCommand({ Bucket: PRIVATE_BUCKET_NAME }));
            console.log('✅ Private bucket created');
        } else {
            console.log('✅ Private bucket already exists');
        }

        // Configure private access (Scaleway doesn't support PutPublicAccessBlock)
        console.log('Configuring private access settings...');
        console.log("   ⚠️  Scaleway doesn't support PutPublicAccessBlock - using bucket policy approach");
        console.log('✅ Private access will be controlled via bucket policies and CORS');

        // Configure CORS for private bucket
        console.log('Applying CORS configuration...');
        await adminS3Client.send(
            new PutBucketCorsCommand({
                Bucket: PRIVATE_BUCKET_NAME,
                CORSConfiguration: corsConfiguration,
            }),
        );
        console.log('✅ CORS configuration applied');

        console.log(`🔒 Private bucket ready: ${PRIVATE_BUCKET_NAME}`);
        console.log('📝 Files in this bucket require authentication to access');
    } catch (error) {
        console.error(`❌ Failed to setup private bucket: ${error}`);
        throw error;
    }
}

async function setupPublicBucket() {
    console.log('\n📦 Setting up PUBLIC bucket for avatars and public assets...');
    console.log(`Bucket name: ${PUBLIC_BUCKET_NAME}`);

    try {
        // Check if bucket exists
        const exists = await checkBucketExists(PUBLIC_BUCKET_NAME!);

        if (!exists) {
            console.log('Creating new public bucket...');
            await adminS3Client.send(new CreateBucketCommand({ Bucket: PUBLIC_BUCKET_NAME }));
            console.log('✅ Public bucket created');
        } else {
            console.log('✅ Public bucket already exists');
        }

        // Configure public access (Scaleway doesn't support PutPublicAccessBlock)
        console.log('Configuring public access settings...');
        console.log("   ⚠️  Scaleway doesn't support PutPublicAccessBlock - using bucket policy approach");
        console.log('✅ Public access will be configured via bucket policy');

        // Set bucket policy for public read access (Scaleway format)
        const bucketPolicy = {
            Statement: [
                {
                    Action: 's3:GetObject', Effect: 'Allow', Principal: '*', Resource: `${PUBLIC_BUCKET_NAME}/*`, Sid: 'PublicReadGetObject',
                },
            ], Version: '2012-10-17',
        };

        console.log('Setting bucket policy for public read access...');
        await adminS3Client.send(
            new PutBucketPolicyCommand({
                Bucket: PUBLIC_BUCKET_NAME,
                Policy: JSON.stringify(bucketPolicy),
            }),
        );
        console.log(' ✅ Bucket policy set for public read access');

        // Configure CORS for public bucket
        console.log('Applying CORS configuration...');
        await adminS3Client.send(
            new PutBucketCorsCommand({
                Bucket: PUBLIC_BUCKET_NAME,
                CORSConfiguration: corsConfiguration,
            }),
        );
        console.log(' ✅ CORS configuration applied');

        console.log(` 🌐 Public bucket ready: ${PUBLIC_BUCKET_NAME}`);
        console.log(`   📸 Files accessible at: https://${PUBLIC_BUCKET_NAME}.s3.${S3_REGION}.scw.cloud/{key}`);
    } catch (error) {
        console.error(` ❌ Failed to setup public bucket: ${error}`);
        throw error;
    }
}

async function verifyConfiguration() {
    console.log('\n🔍 Verifying bucket configurations...');

    try {
        // Verify private bucket
        console.log(`\n Private bucket (${PRIVATE_BUCKET_NAME}):`);
        const privateCors = await adminS3Client.send(new GetBucketCorsCommand({ Bucket: PRIVATE_BUCKET_NAME }));
        console.log(`✅ CORS configured with ${privateCors.CORSRules?.length || 0} rules`);

        try {
            await adminS3Client.send(new GetBucketPolicyCommand({ Bucket: PRIVATE_BUCKET_NAME }));
            console.log('⚠️  Bucket has a policy (should typically be empty for private bucket)');
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchBucketPolicy') {
                console.log('✅ No public bucket policy (correct for private bucket)');
            }
        }

        // Verify public bucket
        console.log(`\n   Public bucket (${PUBLIC_BUCKET_NAME}):`);
        const publicCors = await adminS3Client.send(new GetBucketCorsCommand({ Bucket: PUBLIC_BUCKET_NAME }));
        console.log(`   ✅ CORS configured with ${publicCors.CORSRules?.length || 0} rules`);

        try {
            await adminS3Client.send(new GetBucketPolicyCommand({ Bucket: PUBLIC_BUCKET_NAME }));
            console.log('✅ Public read policy is set');
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchBucketPolicy') {
                console.log('⚠️  No bucket policy found (public read access might not work)');
            }
        }
    } catch (error) {
        console.error('⚠️  Could not verify all configurations:', error);
    }
}

async function validateAppCredentials() {
    console.log('\n🧪 Validating application credentials...');

    try {
        // Test that app credentials can list the buckets
        console.log('Testing bucket access with app credentials...');

        // Check if app can access private bucket
        try {
            await appS3Client.send(new HeadBucketCommand({ Bucket: PRIVATE_BUCKET_NAME }));
            console.log('✅ App can access private bucket');
        } catch (error) {
            console.log('❌ App cannot access private bucket:', error instanceof Error ? error.message : String(error));
        }

        // Check if app can access public bucket
        try {
            await appS3Client.send(new HeadBucketCommand({ Bucket: PUBLIC_BUCKET_NAME }));
            console.log('✅ App can access public bucket');
        } catch (error) {
            console.log('❌ App cannot access public bucket:', error instanceof Error ? error.message : String(error));
        }

        console.log('✅ Application credentials validation completed');
    } catch (error) {
        console.error('⚠️  Application credentials validation failed:', error);
    }
}

async function main() {
    console.log('🚀 S3 Bucket Setup Script');
    console.log('========================');
    console.log(`🌍 Region: ${S3_REGION}`);
    console.log(`🔗 Endpoint: ${S3_ENDPOINT}`);
    console.log(`🔑 Admin Access Key: ${S3_ADMIN_ACCESS_KEY_ID?.substring(0, 10)}...`);
    console.log(`🔑 App Access Key: ${S3_ACCESS_KEY_ID?.substring(0, 10)}...`);

    try {
        // Setup private bucket
        await setupPrivateBucket();

        // Setup public bucket
        await setupPublicBucket();

        // Verify configurations
        await verifyConfiguration();

        // Validate app credentials work
        await validateAppCredentials();

        console.log('\n✨ S3 bucket setup completed successfully!');
        console.log('\n📋 Environment Variables Summary:');
        console.log('Add these to your .env files if not already present:\n');
        console.log('# API .env');
        console.log(`   S3_BUCKET_NAME=${PRIVATE_BUCKET_NAME}`);
        console.log(`   S3_PUBLIC_BUCKET_NAME=${PUBLIC_BUCKET_NAME}`);
        console.log(`   S3_PUBLIC_URL=https://${PUBLIC_BUCKET_NAME}.s3.${S3_REGION}.scw.cloud`);
        console.log('\n   # Frontend .env');
        console.log(`   VITE_S3_PUBLIC_URL=https://${PUBLIC_BUCKET_NAME}.s3.${S3_REGION}.scw.cloud`);
        console.log('\n🎉 All done! Your S3 buckets are ready to use.');
    } catch (error) {
        console.error('\n❌ Setup failed!');
        console.error('Error details:', error);

        if (error && typeof error === 'object' && 'name' in error) {
            if (error.name === 'AccessDenied') {
                console.log('\n💡 Troubleshooting tips:');
                console.log('1. Ensure your S3 credentials have sufficient permissions');
                console.log('2. Check if the bucket names are available (they must be globally unique)');
                console.log('3. Verify your credentials are correctly set in environment variables');
                console.log('4. Try configuring manually through the Scaleway Console');
            } else if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
                console.log('\n💡 The bucket name is already taken. Try a different name.');
            }
        }

        process.exit(1);
    }
}

// Run the setup
main().catch(console.error);
