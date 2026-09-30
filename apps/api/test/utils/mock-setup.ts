/**
 * Mock setup utilities for external services.
 * These mocks allow testing without real API calls to external services.
 *
 * Note: Node.js built-in test doesn't have a built-in mock system.
 * These are placeholder stubs that should be replaced with actual mock implementations
 * based on the project's mocking strategy (e.g., using sinon, manual stubs, etc.)
 */

/**
 * Mock configuration for OpenRouter (AI/LLM service).
 */
export interface MockOpenRouterConfig {
    flashcards?: {
        flashcards: Array<{
            front: string;
            back: string;
            imageUrl?: string;
            audioUrl?: string;
            category?: string;
        }>;
    };
    model?: string;
    usage?: number;
}

/**
 * Sets up mocks for OpenRouter API calls.
 * Mocks the flashcard generation service.
 *
 * @param config - Mock configuration
 */
export async function setupMockOpenRouter(_config: MockOpenRouterConfig = {}): Promise<void> {
    // TODO: Implement actual mocking when mocking strategy is decided
    // For now, this is a placeholder
}

/**
 * Mock configuration for ElevenLabs (Text-to-Speech service).
 */
export interface MockElevenLabsConfig {
    audioData?: Buffer;
    contentType?: string;
    cached?: boolean;
}

/**
 * Sets up mocks for ElevenLabs TTS API calls.
 *
 * @param config - Mock configuration
 */
export async function setupMockElevenLabs(_config: MockElevenLabsConfig = {}): Promise<void> {
    // TODO: Implement actual mocking when mocking strategy is decided
    // For now, this is a placeholder
}

/**
 * Mock configuration for Autumn (billing/usage service).
 */
export interface MockAutumnConfig {
    allowed?: boolean;
    trackSuccess?: boolean;
}

/**
 * Sets up mocks for Autumn billing API calls.
 *
 * @param config - Mock configuration
 */
export async function setupMockAutumn(_config: MockAutumnConfig = {}): Promise<void> {
    // TODO: Implement actual mocking when mocking strategy is decided
    // For now, this is a placeholder
}

/**
 * Mock configuration for S3 storage.
 */
export interface MockS3Config {
    uploadSuccess?: boolean;
    deleteSuccess?: boolean;
    publicUrl?: string;
}

/**
 * Sets up mocks for S3 storage operations.
 *
 * @param config - Mock configuration
 */
export async function setupMockS3(_config: MockS3Config = {}): Promise<void> {
    // TODO: Implement actual mocking when mocking strategy is decided
    // For now, this is a placeholder
}

/**
 * Mock configuration for Plunk (email service).
 */
export interface MockPlunkConfig {
    sendSuccess?: boolean;
}

/**
 * Sets up mocks for Plunk email API calls.
 *
 * @param config - Mock configuration
 */
export async function setupMockPlunk(_config: MockPlunkConfig = {}): Promise<void> {
    // TODO: Implement actual mocking when mocking strategy is decided
    // For now, this is a placeholder
}

/**
 * Sets up all external service mocks with default configurations.
 * Use this for most integration tests to avoid real API calls.
 */
export async function setupAllMocks(): Promise<void> {
    await setupMockOpenRouter();
    await setupMockElevenLabs();
    await setupMockAutumn();
    await setupMockS3();
    await setupMockPlunk();
}

/**
 * Resets all mocks to their original implementations.
 * Call this in t.after() to clean up after tests.
 */
export async function resetAllMocks(): Promise<void> {
    // TODO: Implement actual mock reset when mocking strategy is decided
}

/**
 * Creates a mock multipart file for upload testing.
 *
 * @param filename - File name
 * @param mimeType - MIME type
 * @param content - File content
 * @returns Mock file object
 */
export function createMockFile(
    filename: string,
    mimeType: string,
    content: string = 'test content'
): {
    file: Buffer;
    filename: string;
    mimetype: string;
} {
    return {
        file: Buffer.from(content),
        filename,
        mimetype: mimeType,
    };
}

/**
 * Creates a mock PDF buffer for flashcard generation testing.
 *
 * @returns Buffer containing mock PDF data
 */
export function createMockPdf(): Buffer {
    return Buffer.from('%PDF-1.4\nmock pdf content');
}

/**
 * Creates a mock image buffer for upload testing.
 *
 * @returns Buffer containing mock image data
 */
export function createMockImage(): Buffer {
    // Minimal PNG header
    return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR type
        // Minimal valid 1x1 PNG
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00,
    ]);
}

/**
 * Creates a mock audio buffer for upload testing.
 *
 * @returns Buffer containing mock audio data
 */
export function createMockAudio(): Buffer {
    // Minimal WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(8000, 24);
    header.writeUInt32LE(8000, 28);
    header.writeUInt16LE(1, 32);
    header.writeUInt16LE(8, 34);
    header.write('data', 36);
    header.writeUInt32LE(0, 40);
    return header;
}
