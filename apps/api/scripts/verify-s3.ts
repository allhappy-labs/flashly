import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { bucketName, createS3Client, publicBucketName, publicBucketUrl } from '../config/s3.ts';

async function testBucketOperations() {
    const s3Client = createS3Client();
    const testKey = `test-${Date.now()}.txt`;
    const testContent = 'This is a test file created by verification script';

    console.log('🧪 Testing S3 bucket operations...\n');

    // Test private bucket
    console.log('📁 Testing PRIVATE bucket operations:');
    console.log(`   Bucket: ${bucketName}`);

    try {
        // Test bucket access
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log('✅ Can access private bucket');

        // Test upload
        await s3Client.send(
            new PutObjectCommand({
                Body: testContent, Bucket: bucketName, ContentType: 'text/plain', Key: testKey,
            }),
        );
        console.log('✅ Can upload to private bucket');

        // Test download
        await s3Client.send(
            new GetObjectCommand({
                Bucket: bucketName,
                Key: testKey,
            }),
        );
        console.log('✅ Can download from private bucket');

        // Test delete
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: testKey,
            }),
        );
        console.log('✅ Can delete from private bucket');
    } catch (error) {
        console.log('❌ Private bucket operations failed:', error instanceof Error ? error.message : String(error));
    }

    // Test public bucket
    console.log('\n📁 Testing PUBLIC bucket operations:');
    console.log(`   Bucket: ${publicBucketName}`);

    try {
        // Test bucket access
        await s3Client.send(new HeadBucketCommand({ Bucket: publicBucketName }));
        console.log('✅ Can access public bucket');

        // Test upload
        await s3Client.send(
            new PutObjectCommand({
                Body: testContent, Bucket: publicBucketName, ContentType: 'text/plain', Key: testKey,
            }),
        );
        console.log('✅ Can upload to public bucket');

        // Test download
        await s3Client.send(
            new GetObjectCommand({
                Bucket: publicBucketName,
                Key: testKey,
            }),
        );
        console.log('✅ Can download from public bucket');

        // Test public URL access
        const publicUrl = `${publicBucketUrl}/${testKey}`;
        console.log(`   🌐 Public URL: ${publicUrl}`);

        try {
            const response = await fetch(publicUrl);
            if (response.ok) {
                const content = await response.text();
                console.log('✅ Public URL is accessible');
                console.log(`   📄 Content: "${content.substring(0, 50)}..."`);
            } else {
                console.log(`   ⚠️  Public URL returned status: ${response.status}`);
            }
        } catch (fetchError) {
            console.log(
                '❌ Public URL fetch failed:',
                fetchError instanceof Error ? fetchError.message : String(fetchError),
            );
        }

        // Clean up test file
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: publicBucketName,
                Key: testKey,
            }),
        );
        console.log('✅ Can delete from public bucket');
    } catch (error) {
        console.log('❌ Public bucket operations failed:', error instanceof Error ? error.message : String(error));
    }
}

async function main() {
    console.log('🔍 S3 Configuration Verification');
    console.log('================================\n');

    console.log('📋 Environment Configuration:');
    console.log(`   Private bucket: ${bucketName}`);
    console.log(`   Public bucket: ${publicBucketName}`);
    console.log(`   Public URL: ${publicBucketUrl}`);
    console.log(`   Region: ${process.env.S3_REGION}`);
    console.log(`   Endpoint: ${process.env.S3_ENDPOINT}\n`);

    await testBucketOperations();

    console.log('\n✨ Verification completed!');
    console.log('\n💡 Next steps:');
    console.log('- If all tests passed, your S3 setup is working correctly');
    console.log('- You can now use file upload functionality in your application');
    console.log('- Private files will require authentication');
    console.log('- Public files will be accessible via direct URL');
}

main().catch(console.error);
