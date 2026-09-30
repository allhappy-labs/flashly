import { slug } from "github-slugger";
import { Marked, type Token } from "marked";

const MARKDOWN_BASE_URL = "https://flashly.local";
const MARKDOWN_BASE_ORIGIN = new URL(MARKDOWN_BASE_URL).origin;
const ALLOWED_MARKDOWN_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const sanitizeMarkdownUrl = (value: string): string | null => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.startsWith("//")) {
    return null;
  }

  if (
    normalizedValue.startsWith("#")
    || normalizedValue.startsWith("/")
    || normalizedValue.startsWith("./")
    || normalizedValue.startsWith("../")
  ) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(normalizedValue, MARKDOWN_BASE_URL);

    if (parsedUrl.origin === MARKDOWN_BASE_ORIGIN && parsedUrl.protocol === "https:") {
      return normalizedValue;
    }

    if (ALLOWED_MARKDOWN_PROTOCOLS.has(parsedUrl.protocol)) {
      return parsedUrl.toString();
    }
  } catch {
    return null;
  }

  return null;
};

const safeMarked = new Marked();
const safeRenderer = new safeMarked.Renderer();

safeRenderer.html = () => "";

safeMarked.use({
  renderer: safeRenderer,
  walkTokens: (token: Token) => {
    if (token.type !== "link" && token.type !== "image") {
      return;
    }

    const sanitizedHref = sanitizeMarkdownUrl(token.href);
    token.href = sanitizedHref ?? "#";
  },
});

// slugify
export const slugify = (content: string) => {
  return slug(content);
};

// markdownify
export const markdownify = (content: string, div?: boolean) => {
  const parsedContent = div
    ? safeMarked.parse(content, { async: false })
    : safeMarked.parseInline(content, { async: false });

  return typeof parsedContent === "string" ? parsedContent : "";
};

// humanize
export const humanize = (content: string) => {
  return content
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/[-\s]+/g, " ")
    .replace(/^[a-z]/, function (m) {
      return m.toUpperCase();
    });
};

// titleify
export const titleify = (content: string) => {
  const humanized = humanize(content);
  return humanized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// plainify
export const plainify = (content: string) => {
  const parseMarkdown = safeMarked.parse(content, { async: false });
  const parsedHtml = typeof parseMarkdown === "string" ? parseMarkdown : "";
  const filterBrackets = parsedHtml.replace(/<\/?[^>]+(>|$)/gm, "");
  const filterSpaces = filterBrackets.replace(/[\r\n]\s*[\r\n]/gm, "");
  const stripHTML = htmlEntityDecoder(filterSpaces);
  return stripHTML;
};

// strip entities for plainify
const htmlEntityDecoder = (htmlWithEntities: string) => {
  let entityList: { [key: string]: string } = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
  };
  let htmlWithoutEntities: string = htmlWithEntities.replace(
    /(&amp;|&lt;|&gt;|&quot;|&#39;)/g,
    (entity: string): string => {
      return entityList[entity];
    },
  );
  return htmlWithoutEntities;
};
