import config from "@/config/config.json";
import { markdownify } from "@/lib/utils/textConverter";
import React, { useCallback, useEffect, useState } from "react";

const { enable, expire_days } = config.announcement;
const { default_language } = config.settings;
const announcementMarkup = (content: string) => ({ __html: markdownify(content) });

interface AnnouncementProps {
  lang?: string;
}

type CookieOptions = {
  path?: string;
  expires?: number | Date | string;
  [key: string]: string | number | boolean | Date | undefined;
};

const Cookies = {
  set: (name: string, value: string, options: CookieOptions = {}) => {
    if (typeof document === "undefined") return;

    const defaults: CookieOptions = { path: "/" };
    const opts: CookieOptions = { ...defaults, ...options };

    if (typeof opts.expires === "number") {
      opts.expires = new Date(Date.now() + opts.expires * 864e5);
    }
    if (opts.expires instanceof Date) {
      opts.expires = opts.expires.toUTCString();
    }

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    for (const [key, optionValue] of Object.entries(opts)) {
      if (!optionValue) continue;
      cookieString += `; ${key}`;
      if (optionValue !== true) {
        cookieString += `=${optionValue}`;
      }
    }

    document.cookie = cookieString;
  },

  get: (name: string): string | null => {
    if (typeof document === "undefined") return null;

    const cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
      const [key, value] = cookie.split("=");
      if (decodeURIComponent(key) === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  },

  remove: (name: string, options: CookieOptions = {}) => {
    Cookies.set(name, "", { ...options, expires: -1 });
  },
};

const Announcement: React.FC<AnnouncementProps> = ({ lang = default_language }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translations = await import(`../../i18n/${lang}.json`);
        const announcementContent = translations.default?.announcement || translations.announcement;

        setContent(announcementContent);

        const hasCookie = Cookies.get("announcement-close");
        // console.log("Announcement Debug:", {
        //   enable,
        //   announcementContent,
        //   hasCookie,
        //   lang,
        // });

        if (enable && announcementContent && !hasCookie) {
          setIsVisible(true);
        }
      } catch  {
        console.warn(`Translation file for "${lang}" not found, falling back to "${default_language}"`);
        try {
          const fallbackTranslations = await import(`../../i18n/${default_language}.json`);
          const announcementContent = fallbackTranslations.default?.announcement || fallbackTranslations.announcement;

          setContent(announcementContent);

          if (enable && announcementContent && !Cookies.get("announcement-close")) {
            setIsVisible(true);
          }
        } catch (fallbackError) {
          console.error("Failed to load fallback translations:", fallbackError);
        }
      }
    };

    loadTranslations();
  }, [lang]);

  const handleClose = useCallback(() => {
    Cookies.set("announcement-close", "true", {
      expires: expire_days,
    });
    setIsVisible(false);
  }, []);

  if (!enable || !isVisible || !content) {
    return null;
  }

  return (
    <div className="relative z-999 bg-body shadow-[1px_0_10px_7px_rgba(154,154,154,0.11)] px-4 py-4 pr-12 md:text-lg transition-all duration-300 dark:bg-darkmode-body">
      <p
        dangerouslySetInnerHTML={announcementMarkup(content)}
      />
      <button
        type="button"
        onClick={handleClose}
        className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer flex items-center justify-center w-7 h-7 border border-border rounded-full text-xl transition-colors duration-200 dark:border-darkmode-border"
        aria-label="Close announcement"
      >
        &times;
      </button>
    </div>
  );
};

export default Announcement;
