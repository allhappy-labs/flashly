import 'react-native-markdown-display';

declare module 'react-native-markdown-display' {
  interface MarkdownProps {
    allowedImageHandlers?: string[];
    defaultImageHandler?: string | null;
  }
}
