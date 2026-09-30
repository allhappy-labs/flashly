import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import JSZip from "jszip";
import { Platform } from "react-native";
import {
  EXPORT_CONFIG_FILE_NAME,
  EXPORT_FORMAT_VERSION,
  normalizeQuizEnrichment,
  parseExportConfig,
  parseFlashcardsJsonl,
  type ExportConfig,
} from "@flashly/shared";
import type { ParsedCard } from "../types/models";
import { storeDeckAudio, storeDeckImage } from "./deckMedia";
import { sanitizeImportedCardMedia } from "./import-media-policy";
import { usableMediaUri } from "../utils/media-policy";

export type PickedFile = DocumentPicker.DocumentPickerAsset & { isZip: boolean };
export type ImportPayload = {
  name?: string;
  config: ExportConfig;
  text: string;
  isZip: boolean;
  images?: Record<string, string>;
  audio?: Record<string, string>;
  cacheDirUri?: string;
};

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1_000;
const MAX_CORE_TEXT_BYTES = 10 * 1024 * 1024;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const MAX_EXPANDED_ARCHIVE_BYTES = 100 * 1024 * 1024;

export type ImportErrorCode =
  | "IMPORT_MISSING_FILE_ASSET"
  | "IMPORT_UNSUPPORTED_FILE_TYPE"
  | "IMPORT_ARCHIVE_TOO_LARGE"
  | "IMPORT_TOO_MANY_ENTRIES"
  | "IMPORT_INVALID_ENTRY_METADATA"
  | "IMPORT_ARCHIVE_EXPANDED_TOO_LARGE"
  | "IMPORT_CORE_DATA_TOO_LARGE"
  | "IMPORT_ENTRY_TOO_LARGE"
  | "IMPORT_MISSING_CONFIG"
  | "IMPORT_INVALID_CONFIG"
  | "IMPORT_UNSUPPORTED_VERSION"
  | "IMPORT_MISSING_CARD_DATA"
  | "IMPORT_INVALID_CARD_DATA"
  | "IMPORT_NO_CARDS"
  | "IMPORT_INVALID_ARCHIVE";

export const ImportErrorCode = {
  MissingFileAsset: "IMPORT_MISSING_FILE_ASSET",
  UnsupportedFileType: "IMPORT_UNSUPPORTED_FILE_TYPE",
  ArchiveTooLarge: "IMPORT_ARCHIVE_TOO_LARGE",
  TooManyEntries: "IMPORT_TOO_MANY_ENTRIES",
  InvalidEntryMetadata: "IMPORT_INVALID_ENTRY_METADATA",
  ArchiveExpandedTooLarge: "IMPORT_ARCHIVE_EXPANDED_TOO_LARGE",
  CoreDataTooLarge: "IMPORT_CORE_DATA_TOO_LARGE",
  EntryTooLarge: "IMPORT_ENTRY_TOO_LARGE",
  MissingConfig: "IMPORT_MISSING_CONFIG",
  InvalidConfig: "IMPORT_INVALID_CONFIG",
  UnsupportedVersion: "IMPORT_UNSUPPORTED_VERSION",
  MissingCardData: "IMPORT_MISSING_CARD_DATA",
  InvalidCardData: "IMPORT_INVALID_CARD_DATA",
  NoCards: "IMPORT_NO_CARDS",
  InvalidArchive: "IMPORT_INVALID_ARCHIVE",
} satisfies Record<string, ImportErrorCode>;

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(code);
    this.name = "ImportError";
    this.code = code;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function declaredUncompressedSize(entry: unknown): number | null {
  if (!isObjectRecord(entry) || !("_data" in entry)) return null;
  const data = entry._data;
  if (!isObjectRecord(data) || !("uncompressedSize" in data)) return null;
  const size = data.uncompressedSize;
  if (
    typeof size !== "number"
    || !Number.isSafeInteger(size)
    || size < 0
  ) {
    return null;
  }
  return size;
}

function archiveEntryName(entry: unknown): string | null {
  if (!isObjectRecord(entry) || typeof entry.name !== "string") return null;
  return entry.name;
}

function archiveEntryIsDirectory(entry: unknown): boolean | null {
  if (!isObjectRecord(entry) || typeof entry.dir !== "boolean") return null;
  return entry.dir;
}

function isCoreArchivePath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower === EXPORT_CONFIG_FILE_NAME.toLowerCase() || lower === "deck.jsonl";
}

export function validateArchiveEntryBudgets(entries: readonly unknown[]): Set<string> {
  let aggregateBytes = 0;
  const skippedOversizedMedia = new Set<string>();

  for (const entry of entries) {
    const name = archiveEntryName(entry);
    const isDirectory = archiveEntryIsDirectory(entry);
    if (name === null || isDirectory === null) {
      throw new ImportError(ImportErrorCode.InvalidEntryMetadata);
    }
    if (isDirectory) continue;
    const size = declaredUncompressedSize(entry);
    if (size === null) {
      throw new ImportError(ImportErrorCode.InvalidEntryMetadata);
    }
    aggregateBytes += size;
    if (aggregateBytes > MAX_EXPANDED_ARCHIVE_BYTES) {
      throw new ImportError(ImportErrorCode.ArchiveExpandedTooLarge);
    }
    if (isCoreArchivePath(name) && size > MAX_CORE_TEXT_BYTES) {
      throw new ImportError(ImportErrorCode.CoreDataTooLarge);
    }
    if (isSafePackMediaPath(name) && size > MAX_MEDIA_BYTES) {
      skippedOversizedMedia.add(name);
      continue;
    }
    if (!isCoreArchivePath(name) && !isSafePackMediaPath(name) && size > MAX_MEDIA_BYTES) {
      throw new ImportError(ImportErrorCode.EntryTooLarge);
    }
  }

  return skippedOversizedMedia;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function validateCoreImportText(value: string): void {
  if (utf8ByteLength(value) > MAX_CORE_TEXT_BYTES) {
    throw new ImportError(ImportErrorCode.CoreDataTooLarge);
  }
}

export function normalizeIncomingFlashlyUri(value: string): string | null {
  const trimmed = value.trim();
  const route = trimmed.split(/[?#]/, 1)[0] ?? "";
  if (/^content:\/\/[^/?#]+(?:[/?#]|$)/i.test(route)) return route;
  if (!/^file:\/\//i.test(route)) return null;
  if (!route.toLowerCase().endsWith(".flashly")) return null;
  return route;
}

export function isSafePackMediaPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/")) return false;
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return false;
  const lower = normalized.toLowerCase();
  return (
    lower.startsWith("media/images/") || lower.startsWith("media/audio/")
  ) && segments.length > 2;
}

function normalizedPackMediaPath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  return isSafePackMediaPath(normalized) ? normalized : null;
}

function mediaFolderForPath(path: string): "images" | "audio" {
  return path.toLowerCase().startsWith("media/images/") ? "images" : "audio";
}

function base64ExceedsByteLimit(base64: string, byteLimit: number): boolean {
  return base64.length > Math.ceil((byteLimit * 4) / 3) + 4;
}

function addMediaAliases(
  target: Record<string, string>,
  normalized: string,
  value: string,
  folder: "images" | "audio",
) {
  target[normalized] = value;
  const fileOnly = normalized.split("/").pop();
  if (!fileOnly) return;
  const fallback = `media/${folder}/${fileOnly}`;
  if (!target[fallback]) target[fallback] = value;
  const legacyFallback = `${folder}/${fileOnly}`;
  if (!target[legacyFallback]) target[legacyFallback] = value;
}

export async function pickImportFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
  });

  if (res.canceled) return null;

  const asset = res.assets?.[0];
  if (!asset) throw new ImportError(ImportErrorCode.MissingFileAsset);

  // Only accept .flashly files for mobile imports
  const isFlashlyFile = asset?.name?.toLowerCase().endsWith(".flashly");
  if (!isFlashlyFile) {
    throw new ImportError(ImportErrorCode.UnsupportedFileType);
  }

  return { ...asset, isZip: true };
}

export function parseCardsFromText(
  text: string,
): ParsedCard[] {
  const cleaned = text.replace(/^\ufeff/, "").trim();
  if (!cleaned) return [];

  const parsed = parseFlashcardsJsonl(cleaned);
  return parsed.flashcards.map((card) => ({
    front: card.front.trim(),
    back: card.back.trim(),
    imageUrl: typeof card.imageUrl === "string" ? card.imageUrl.trim() || undefined : undefined,
    imagePath: typeof card.imagePath === "string" ? card.imagePath.trim() || undefined : undefined,
    audioUrl: typeof card.audioUrl === "string" ? card.audioUrl.trim() || undefined : undefined,
    audioPath: typeof card.audioPath === "string" ? card.audioPath.trim() || undefined : undefined,
    category: typeof card.category === "string" ? card.category.trim() || undefined : undefined,
    pos: typeof card.pos === "string" ? card.pos.trim() || undefined : undefined,
    gender: typeof card.gender === "string" ? card.gender.trim() || undefined : undefined,
    example: typeof card.example === "string" ? card.example.trim() || undefined : undefined,
    tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : undefined,
    quiz: normalizeQuizEnrichment(card.quiz),
  })).filter((card) => card.front && card.back);
}

function dataUrlForImage(base64: string, extension: string) {
  const cleanExt = extension.replace(".", "").toLowerCase();
  const mime = cleanExt === "jpg" ? "jpeg" : cleanExt;
  return `data:image/${mime};base64,${base64}`;
}

export async function readImportFile(picked: PickedFile): Promise<ImportPayload> {
  let cacheDirUri: string | undefined;
  try {
    if (typeof picked.size === "number" && picked.size > MAX_ARCHIVE_BYTES) {
      throw new ImportError(ImportErrorCode.ArchiveTooLarge);
    }
    if (picked.file && picked.file.size > MAX_ARCHIVE_BYTES) {
      throw new ImportError(ImportErrorCode.ArchiveTooLarge);
    }

    let zipData: ArrayBuffer | string;
    if (Platform.OS === "web") {
      zipData = await (picked.file?.arrayBuffer?.() ?? (await fetch(picked.uri)).arrayBuffer());
    } else {
      const sourceFile = new File(picked.uri);
      if (sourceFile.size > MAX_ARCHIVE_BYTES) {
        throw new ImportError(ImportErrorCode.ArchiveTooLarge);
      }
      zipData = await sourceFile.base64();
    }

    const archiveBytes = typeof zipData === "string"
      ? Math.ceil((zipData.length * 3) / 4)
      : zipData.byteLength;
    if (archiveBytes > MAX_ARCHIVE_BYTES) {
      throw new ImportError(ImportErrorCode.ArchiveTooLarge);
    }

    const zip = Platform.OS === "web"
      ? await JSZip.loadAsync(zipData)
      : await JSZip.loadAsync(zipData, { base64: true });
    const files = Object.values(zip.files);
    if (files.length > MAX_ARCHIVE_ENTRIES) {
      throw new ImportError(ImportErrorCode.TooManyEntries);
    }
    const skippedOversizedMedia = validateArchiveEntryBudgets(files);
    const configFile = files.find(
      (file) => file.name.toLowerCase() === EXPORT_CONFIG_FILE_NAME.toLowerCase() && !file.dir,
    );
    if (!configFile) throw new ImportError(ImportErrorCode.MissingConfig);
    const configText = await configFile.async("string");
    validateCoreImportText(configText);
    const config = parseExportConfig(configText);
    if (!config) throw new ImportError(ImportErrorCode.InvalidConfig);
    if (config.version !== EXPORT_FORMAT_VERSION) {
      throw new ImportError(ImportErrorCode.UnsupportedVersion);
    }
    const jsonlFile = files.find((file) => file.name.toLowerCase() === "deck.jsonl" && !file.dir);
    if (!jsonlFile) throw new ImportError(ImportErrorCode.MissingCardData);
    const text = await jsonlFile.async("string");
    validateCoreImportText(text);

    const images: Record<string, string> = {};
    const audio: Record<string, string> = {};
    if (Platform.OS === "web") {
      for (const file of files) {
        if (file.dir) continue;
        if (skippedOversizedMedia.has(file.name)) continue;
        const sourcePath = file.unsafeOriginalName ?? file.name;
        const normalized = normalizedPackMediaPath(sourcePath);
        if (!normalized) continue;
        const base64 = await file.async("base64");
        if (base64ExceedsByteLimit(base64, MAX_MEDIA_BYTES)) continue;
        const extension = file.name.split(".").pop() ?? "bin";
        const folder = mediaFolderForPath(normalized);
        if (folder === "images") {
          addMediaAliases(images, normalized, dataUrlForImage(base64, extension), folder);
        } else {
          const cleanExt = extension.replace(".", "").toLowerCase();
          const mime = cleanExt === "mp3" ? "mpeg" : cleanExt;
          addMediaAliases(audio, normalized, `data:audio/${mime};base64,${base64}`, folder);
        }
      }
    } else {
      const cacheDir = new Directory(Paths.cache, `import-${Date.now()}`);
      cacheDir.create({ intermediates: true, idempotent: true });
      cacheDirUri = cacheDir.uri;
      for (const file of files) {
        if (file.dir) continue;
        if (skippedOversizedMedia.has(file.name)) continue;
        const sourcePath = file.unsafeOriginalName ?? file.name;
        const normalized = normalizedPackMediaPath(sourcePath);
        if (!normalized) continue;
        const base64 = await file.async("base64");
        if (base64ExceedsByteLimit(base64, MAX_MEDIA_BYTES)) continue;
        const folder = mediaFolderForPath(normalized);
        const outputName = normalized.slice(`media/${folder}/`.length);
        const outputParts = outputName.split("/");
        const fileName = outputParts.pop();
        if (!fileName) continue;
        let targetDir = new Directory(cacheDir, folder);
        targetDir.create({ intermediates: true, idempotent: true });
        if (outputParts.length) {
          const subDir = new Directory(targetDir, outputParts.join("/"));
          subDir.create({ intermediates: true, idempotent: true });
          targetDir = subDir;
        }
        const outputFile = new File(targetDir, fileName);
        outputFile.create({ overwrite: true });
        outputFile.write(base64, { encoding: "base64" });
        if (folder === "images") {
          addMediaAliases(images, normalized, outputFile.uri, folder);
        } else {
          addMediaAliases(audio, normalized, outputFile.uri, folder);
        }
      }
    }

    return { name: picked.name, config, text, isZip: true, images, audio, cacheDirUri };
  } catch (error) {
    if (cacheDirUri) {
      try {
        deleteImportCacheDirectory(cacheDirUri);
      } catch {
        // Import failure remains primary; cleanup is best-effort.
      }
    }
    if (error instanceof ImportError) throw error;
    throw new ImportError(ImportErrorCode.InvalidArchive);
  }
}

export function deleteImportCacheDirectory(cacheDirUri: string | null | undefined): void {
  if (!cacheDirUri) return;
  const directory = new Directory(cacheDirUri);
  if (directory.exists) directory.delete();
}

export type PreparedImportPayload = Readonly<{
  payload: ImportPayload;
  cards: ParsedCard[];
}>;

export function prepareImportPayload(
  payload: ImportPayload,
  cleanup: (cacheDirUri: string | null | undefined) => void = deleteImportCacheDirectory,
): PreparedImportPayload {
  try {
    const cards = parseCardsFromText(payload.text);
    if (!cards.length) throw new ImportError(ImportErrorCode.NoCards);
    return { payload, cards };
  } catch (error) {
    cleanup(payload.cacheDirUri);
    if (error instanceof ImportError) throw error;
    throw new ImportError(ImportErrorCode.InvalidCardData);
  }
}

export async function readPreparedImportFile(picked: PickedFile): Promise<PreparedImportPayload> {
  return prepareImportPayload(await readImportFile(picked));
}

export async function readPreparedImportWithOwnership(
  readPrepared: () => Promise<PreparedImportPayload>,
  isOwnerActive: () => boolean,
  adopt: (prepared: PreparedImportPayload) => void,
  cleanup: (cacheDirUri: string | null | undefined) => void = deleteImportCacheDirectory,
): Promise<boolean> {
  let ownedCacheDirUri: string | undefined;
  let transferred = false;
  try {
    const prepared = await readPrepared();
    ownedCacheDirUri = prepared.payload.cacheDirUri;
    if (!isOwnerActive()) return false;
    adopt(prepared);
    transferred = true;
    return true;
  } finally {
    if (!transferred) cleanup(ownedCacheDirUri);
  }
}

/**
 * Resolves media files for imported cards from zip archives.
 * Handles image and audio file resolution with sophisticated fallback logic.
 *
 * @param cards - Parsed cards to resolve media for
 * @param zipImages - Map of image paths to cached URIs from zip
 * @param zipAudio - Map of audio paths to cached URIs from zip
 * @param deckId - Target deck ID for storing resolved media
 * @param deckName - Target deck name for organizing media storage
 * @returns Tuple of (resolved cards, missing images count, missing audio count)
 */
export async function resolveMediaForCards(
  cards: ParsedCard[],
  zipImages: Record<string, string> | null,
  zipAudio: Record<string, string> | null,
  deckId: string,
  deckName: string,
  allowRemoteMedia: boolean,
): Promise<{
  cards: ParsedCard[];
  missingImages: number;
  missingAudio: number;
  storedMediaUris: string[];
}> {
  const resolvedImages = new Map<string, string>();
  const resolvedAudio = new Map<string, string>();
  const storedMediaUris = new Set<string>();
  const normalizePath = (path: string, folder: "images" | "audio") => {
    const standardized = path.replace(/\\/g, "/");
    if (isSafePackMediaPath(standardized)) return standardized;
    if (standardized.startsWith(`${folder}/`)) {
      const legacyPath = `media/${standardized}`;
      return isSafePackMediaPath(legacyPath) ? legacyPath : null;
    }
    return null;
  };
  const addCandidateKeys = (reference: string | undefined, folder: "images" | "audio") => {
    const keys = new Set<string>();
    if (!reference) return keys;
    const normalized = normalizePath(reference, folder);
    if (!normalized) return keys;
    keys.add(normalized);
    const fileOnly = normalized.split("/").pop();
    if (fileOnly) {
      keys.add(`media/${folder}/${fileOnly}`);
      keys.add(`${folder}/${fileOnly}`);
    }
    return keys;
  };

  let missingImages = 0;
  let missingAudio = 0;
  const resolvedCards: ParsedCard[] = [];

  for (const card of cards) {
    let imageUrl = usableMediaUri(card.imageUrl, allowRemoteMedia) ?? undefined;
    let audioUrl = usableMediaUri(card.audioUrl, allowRemoteMedia) ?? undefined;
    let foundImage = false;
    let foundAudio = false;
    const imageKeys = new Set([
      ...addCandidateKeys(card.imagePath, "images"),
      ...addCandidateKeys(card.imageUrl, "images"),
    ]);
    const audioKeys = new Set([
      ...addCandidateKeys(card.audioPath, "audio"),
      ...addCandidateKeys(card.audioUrl, "audio"),
    ]);

    if (zipImages) {
      for (const key of imageKeys) {
        const cachedUri = zipImages[key];
        if (!cachedUri) continue;
        const existing = resolvedImages.get(key);
        if (existing) {
          imageUrl = existing;
          foundImage = true;
          break;
        }
        try {
          const stored = await storeDeckImage({ deckId, deckName, sourceUri: cachedUri, preferredName: key });
          if (!stored) continue;
          resolvedImages.set(key, stored);
          storedMediaUris.add(stored);
          imageUrl = stored;
          foundImage = true;
          break;
        } catch {
          // Missing optional media is reported after the card import succeeds.
        }
      }
    }

    if (zipAudio) {
      for (const key of audioKeys) {
        const cachedUri = zipAudio[key];
        if (!cachedUri) continue;
        const existing = resolvedAudio.get(key);
        if (existing) {
          audioUrl = existing;
          foundAudio = true;
          break;
        }
        try {
          const stored = await storeDeckAudio({ deckId, deckName, sourceUri: cachedUri, preferredName: key });
          if (!stored) continue;
          resolvedAudio.set(key, stored);
          storedMediaUris.add(stored);
          audioUrl = stored;
          foundAudio = true;
          break;
        } catch {
          // Missing optional media is reported after the card import succeeds.
        }
      }
    }

    if (imageKeys.size && !foundImage) missingImages += 1;
    if (audioKeys.size && !foundAudio) missingAudio += 1;
    resolvedCards.push(sanitizeImportedCardMedia({ ...card, imageUrl, audioUrl }, allowRemoteMedia));
  }

  return { cards: resolvedCards, missingImages, missingAudio, storedMediaUris: [...storedMediaUris] };
}
