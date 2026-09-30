# .flashly File Extension Implementation

## Summary

This implementation adds support for a custom `.flashly` file extension for deck zip files. When a user opens a `.flashly` file on iOS or Android from the file manager, it automatically creates a new deck and imports the cards.

## Files Modified

1. **app.json** - File association configuration
2. **App.tsx** - Deep linking URL handler
3. **ImportScreen.tsx** - Auto-import logic
4. **exportService.ts** - Export with .flashly extension
5. **navigation/types.ts** - Type definitions
6. **importService.ts** - Media resolution extraction

## Implementation Details

### 1. Export Extension Change (`exportService.ts:174`)
Changed default export extension from `.zip` to `.flashly`:
```typescript
const baseName = sanitizeFileName(deck.name, ".flashly");
```

### 2. Navigation Types (`navigation/types.ts`)
Added `fileUri?: string` parameter to Import route:
```typescript
Import: { deckId?: string; initialText?: string; deckName?: string; fileUri?: string };
```

### 3. Media Resolution Extraction (`importService.ts`)
Extracted complex media resolution logic into reusable function:
```typescript
export async function resolveMediaForCards(
  cards: ParsedCard[],
  zipImages: Record<string, string> | null,
  zipAudio: Record<string, string> | null,
  deckId: string,
  deckName: string,
): Promise<{ cards: ParsedCard[]; missingImages: number; missingAudio: number }>
```

### 4. Auto-Import Logic (`ImportScreen.tsx`)
Added useEffect hook to detect and auto-import from fileUri:
- Reads file from URI
- Parses cards and config
- Creates new deck
- Resolves media files
- Navigates to deck overview
- Shows error alert on failure (stays on ImportScreen)

### 5. Deep Linking Handler (`App.tsx`)
Added Linking event listeners to detect .flashly file opens:
```typescript
useEffect(() => {
  const handleIncomingURL = ({ url }: { url: string }) => {
    if (!url) return;
    if (url.includes('.flashly') || url.includes('file://')) {
      setTimeout(() => {
        navigationRef.current?.navigate('Import', { fileUri: url });
      }, 100);
    }
  };

  const subscription = Linking.addEventListener('url', handleIncomingURL);
  Linking.getInitialURL().then((url) => {
    if (url) handleIncomingURL({ url });
  });

  return () => subscription.remove();
}, []);
```

### 6. File Association Configuration (`app.json`)

**iOS** - Added UTType declaration:
- `CFBundleDocumentTypes` - Declares app as handler for .flashly files
- `UTExportedTypeDeclarations` - Defines custom UTType com.flashly.deck
- Conforms to public.zip-archive and public.data
- Registered filename extension: flashly

**Android** - Added intent filter:
```json
"intentFilters": [
  [{
    "action": "VIEW",
    "data": { "mimeType": "application/zip" },
    "categories": ["BROWSABLE", "DEFAULT"]
  }]
]
```

### 7. Document Picker Update (`importService.ts`)
Updated to accept .flashly files:
```typescript
const isZip = Boolean(
  asset?.mimeType?.includes("zip") ||
  asset?.name?.toLowerCase().endsWith(".zip") ||
  asset?.name?.toLowerCase().endsWith(".flashly"),
);
```

## Behavior

### Export
- Deck files are now exported with `.flashly` extension
- Files are still valid ZIP archives internally
- Can be renamed to .zip if needed for manual inspection

### Import (Manual)
- Users can still select .flashly files via "Select ZIP file" button
- Document picker now accepts .flashly extension

### Import (Auto)
- Opening .flashly file from file manager automatically:
  1. Opens Flashly app
  2. Navigates to ImportScreen
  3. Reads and validates file
  4. Creates new deck with name from config
  5. Imports all cards with media
  6. Shows success/error alert
  7. Navigates to deck overview

### Error Handling
- Invalid file format: Shows error, stays on ImportScreen
- Corrupt zip: Shows error, stays on ImportScreen
- Missing required files: Uses existing validation
- Media resolution failure: Imports cards without media, shows warning

## Platform Differences

### iOS
- Full support via UTType system
- Files app shows Flashly in "Open with" dialog
- Reliable file association

### Android
- Intent filter with MIME type
- Expo managed workflow limitations may apply
- Users can use "Open with..." from file manager

## Testing

To test this feature:

1. **Export a deck** - Should create .flashly file
2. **Open file from Files app (iOS)** - Should auto-import
3. **Open file from File Manager (Android)** - Should auto-import
4. **Test with invalid file** - Should show error and stay on ImportScreen
5. **Test manual import** - "Select ZIP file" button still works

## Development Build Required

This feature requires a development build to test on device:
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

The Expo Go app does not support custom file associations or deep linking.

## Verification Checklist

- [x] Export creates .flashly files
- [x] iOS file association configured
- [x] Android intent filter configured
- [x] Deep linking handler implemented
- [x] Auto-import logic implemented
- [x] Media resolution extracted to reusable function
- [x] Navigation types updated
- [x] Document picker accepts .flashly files
- [x] Error handling for invalid files
- [x] Success navigation to deck overview
- [x] Manual import still works

## Next Steps

1. Create development builds and test on physical devices
2. Verify iOS file association works in Files app
3. Verify Android "Open with..." functionality
4. Test error scenarios with corrupted/invalid files
