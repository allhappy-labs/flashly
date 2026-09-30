import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { Platform, Share } from "react-native";
import {
  EXPORT_CONFIG_FILE_NAME,
  EXPORT_FORMAT_VERSION,
  normalizeQuizEnrichment,
  type ExportConfig,
} from "@flashly/shared";
import { APP_CAPABILITIES } from "../config/app-mode";
import type { Card, DeckWithStats } from "../types/models";
import { getAudioFileName, getImageFileName } from "./deckMedia";
import { usableMediaUri } from "../utils/media-policy";
import { sanitizeMarkdownImageTargets } from "../utils/markdown-media-sanitizer";

type ZipImageSource = { type: "data"; base64: string; extension: string };

function getUniqueId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeSlug(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-z0-9\-_]+/gi, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "card";
}

function buildJsonl(
  cards: Card[],
  imagePathByUri: Map<string, string>,
  audioPathByUri: Map<string, string>,
) {
  return cards
    .map((card) => {
      const front = sanitizeMarkdownImageTargets(card.front, APP_CAPABILITIES.remoteMedia);
      const back = sanitizeMarkdownImageTargets(card.back, APP_CAPABILITIES.remoteMedia);
      const trimmedImageUrl = usableMediaUri(card.imageUrl, APP_CAPABILITIES.remoteMedia) ?? "";
      const trimmedAudioUrl = usableMediaUri(card.audioUrl, APP_CAPABILITIES.remoteMedia) ?? "";
      const mappedImagePath = trimmedImageUrl ? imagePathByUri.get(trimmedImageUrl) : undefined;
      const mappedAudioPath = trimmedAudioUrl ? audioPathByUri.get(trimmedAudioUrl) : undefined;
      const imagePath = mappedImagePath || "";
      const audioPath = mappedAudioPath || "";
      const imageUrl = imagePath ? "" : trimmedImageUrl;
      const audioUrl = audioPath ? "" : trimmedAudioUrl;

      return JSON.stringify({
        front,
        back,
        imageUrl: imageUrl || undefined,
        imagePath: imagePath || undefined,
        audioUrl: audioUrl || undefined,
        audioPath: audioPath || undefined,
        category: card.category ?? undefined,
        pos: card.pos ?? undefined,
        gender: card.gender ?? undefined,
        example: card.example ?? undefined,
        tags: card.tags?.length ? card.tags : undefined,
        quiz: normalizeQuizEnrichment(card.quiz),
      });
    })
    .join("\n");
}

function sanitizeFileName(name: string, extension: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-z0-9\-_]+/gi, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const base = safe || "deck";
  const maxLength = 120;
  const trimmed = base.length + extension.length > maxLength ? base.slice(0, maxLength - extension.length) : base;
  return `${trimmed || "deck"}${extension}`;
}

function buildExportConfig(
  deck: DeckWithStats,
  cardCount: number,
  materialType?: string,
  deckType?: string,
  locale?: string
): ExportConfig {
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    deck: {
      name: deck.name,
      description: deck.description ?? null,
      locale,
      materialType,
      deckType,
    },
    cardCount,
    app: {
      name: "Flashly",
      platform: Platform.OS,
    },
  };
}

export async function buildDeckArchive(
  deck: DeckWithStats,
  cards: Card[],
  materialType?: string,
  deckType?: string,
  locale?: string
) {
  const imagePathByUri = new Map<string, string>();
  const audioPathByUri = new Map<string, string>();
  const imagesToZip: Array<{ zipPath: string; source: ZipImageSource }> = [];
  const audioToZip: Array<{ zipPath: string; source: ZipImageSource }> = [];
  const usedPaths = new Set<string>();

  const ensureUniqueZipPath = (desired: string) => {
    if (!usedPaths.has(desired)) {
      usedPaths.add(desired);
      return desired;
    }
    const match = desired.match(/^(.*?)(\.[a-z0-9]+)?$/i);
    const base = match?.[1] ?? desired;
    const ext = match?.[2] ?? "";
    let counter = 1;
    let next = `${base}-${counter}${ext}`;
    while (usedPaths.has(next) && counter < 200) {
      counter += 1;
      next = `${base}-${counter}${ext}`;
    }
    usedPaths.add(next);
    return next;
  };

  const registerImage = (uri: string, source: ZipImageSource, preferredName: string) => {
    if (imagePathByUri.has(uri)) return;
    const zipPath = ensureUniqueZipPath(`media/images/${preferredName}`);
    imagePathByUri.set(uri, zipPath);
    imagesToZip.push({ zipPath, source });
  };

  const registerAudio = (uri: string, source: ZipImageSource, preferredName: string) => {
    if (audioPathByUri.has(uri)) return;
    const zipPath = ensureUniqueZipPath(`media/audio/${preferredName}`);
    audioPathByUri.set(uri, zipPath);
    audioToZip.push({ zipPath, source });
  };

  const isRemoteUri = (uri: string) => /^https?:\/\//i.test(uri);
  const isDataImageUri = (uri: string) => uri.startsWith("data:image/");
  const isDataAudioUri = (uri: string) => uri.startsWith("data:audio/");

  const readLocalFileBase64 = async (uri: string) => {
    try {
      const file = new File(uri);
      if (!file.exists && !uri.startsWith("content://") && !uri.startsWith("ph://")) {
        return null;
      }
      return await file.base64();
    } catch {
      return null;
    }
  };

  for (const card of cards) {
    const nameBase = sanitizeSlug(card.front || card.back || "card");
    const uri = card.imageUrl?.trim();
    if (!uri) continue;
    if (isDataImageUri(uri)) {
      const match = uri.match(/^data:image\/([a-z0-9+.-]+);base64,(.*)$/i);
      if (match) {
        const extension = `.${match[1].replace("jpeg", "jpg")}`;
        const fileName = `${nameBase}-${getUniqueId()}${extension}`;
        registerImage(uri, { type: "data", base64: match[2], extension }, fileName);
      }
      continue;
    }
    if (isRemoteUri(uri)) continue;
    const base64 = await readLocalFileBase64(uri);
    if (!base64) continue;
    const extension = (getImageFileName(uri)?.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".jpg").toLowerCase();
    const fileName = `${nameBase}-${getUniqueId()}${extension}`;
    registerImage(uri, { type: "data", base64, extension }, fileName);
  }

  for (const card of cards) {
    const nameBase = sanitizeSlug(card.front || card.back || "card");
    const uri = card.audioUrl?.trim();
    if (!uri) continue;
    if (isDataAudioUri(uri)) {
      const match = uri.match(/^data:audio\/([a-z0-9+.-]+);base64,(.*)$/i);
      if (match) {
        const extension = `.${match[1].replace("mpeg", "mp3")}`;
        const fileName = `${nameBase}-${getUniqueId()}${extension}`;
        registerAudio(uri, { type: "data", base64: match[2], extension }, fileName);
      }
      continue;
    }
    if (isRemoteUri(uri)) continue;
    const base64 = await readLocalFileBase64(uri);
    if (!base64) continue;
    const extension = (getAudioFileName(uri)?.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".mp3").toLowerCase();
    const fileName = `${nameBase}-${getUniqueId()}${extension}`;
    registerAudio(uri, { type: "data", base64, extension }, fileName);
  }

  const jsonl = buildJsonl(cards, imagePathByUri, audioPathByUri);
  const exportConfig = buildExportConfig(deck, cards.length, materialType, deckType, locale);
  const exportConfigJson = JSON.stringify(exportConfig, null, 2);
  const zip = new JSZip();
  zip.file(EXPORT_CONFIG_FILE_NAME, exportConfigJson);
  zip.file("deck.jsonl", jsonl);
  for (const entry of imagesToZip) {
    zip.file(entry.zipPath, entry.source.base64, { base64: true });
  }
  for (const entry of audioToZip) {
    zip.file(entry.zipPath, entry.source.base64, { base64: true });
  }
  return zip;
}

export async function exportDeck(
  deck: DeckWithStats,
  cards: Card[],
  materialType?: string,
  deckType?: string,
  locale?: string
) {
  const zip = await buildDeckArchive(deck, cards, materialType, deckType, locale);
  const baseName = sanitizeFileName(deck.name, ".flashly");
  const extensionIndex = baseName.lastIndexOf(".");
  const nameOnly = extensionIndex >= 0 ? baseName.slice(0, extensionIndex) : baseName;
  const extension = extensionIndex >= 0 ? baseName.slice(extensionIndex) : ".zip";

  if (Platform.OS === 'web') {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = baseName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const zipBase64 = await zip.generateAsync({ type: "base64" });

  let counter = 0;
  let file = new File(Paths.document, baseName);
  while (file.exists && counter < 50) {
    counter += 1;
    file = new File(Paths.document, `${nameOnly}-${counter}${extension}`);
  }
  file.create({ overwrite: true });
  file.write(zipBase64, { encoding: "base64" });

  if (Platform.OS === 'ios') {
    await Share.share({ url: file.uri, title: file.name });
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('SharingUnavailable');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/zip",
    dialogTitle: file.name,
  });
}
