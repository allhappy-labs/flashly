export type MarkdownImagePolicy = Readonly<{
  allowedImageHandlers: string[];
  defaultImageHandler: string | null;
}>;

const LOCAL_IMAGE_POLICY: MarkdownImagePolicy = {
  allowedImageHandlers: ['data:image/', 'file://', 'content://', 'ph://'],
  defaultImageHandler: null,
};

const HOSTED_IMAGE_POLICY: MarkdownImagePolicy = {
  allowedImageHandlers: [
    'data:image/png;base64',
    'data:image/gif;base64',
    'data:image/jpeg;base64',
    'https://',
    'http://',
  ],
  defaultImageHandler: 'https://',
};

export function markdownImagePolicy(allowRemote: boolean): MarkdownImagePolicy {
  return allowRemote ? HOSTED_IMAGE_POLICY : LOCAL_IMAGE_POLICY;
}
