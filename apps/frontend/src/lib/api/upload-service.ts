/**
 * Upload Service - API client for file uploads
 *
 * This service wraps all upload-related API calls with neverthrow Result types
 * for type-safe error handling throughout the frontend.
 *
 * API Endpoints:
 * - POST /api/upload/image      - Upload image file
 * - POST /api/upload/audio      - Upload audio file
 * - DELETE /api/upload/:id      - Delete uploaded file
 */

import { getApiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface UploadResult {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  url: string;
}

// ============================================================================
// Upload Operations
// ============================================================================

/**
 * Upload an image file
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload/image', {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type header, let browser set it with boundary
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload image');
  }

  return response.json();
}

/**
 * Upload an audio file
 */
export async function uploadAudio(file: File): Promise<UploadResult> {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload/audio', {
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type header, let browser set it with boundary
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload audio');
  }

  return response.json();
}

/**
 * Delete an uploaded file
 */
export async function deleteUpload(uploadId: string): Promise<void> {
  const api = getApiClient();
  if (!api) {
    throw new Error('API client not initialized');
  }

  const response = await fetch(`/api/upload/${uploadId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete file');
  }
}
