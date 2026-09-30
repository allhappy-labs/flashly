import config from "@/config/config.json";
import languages from "@/config/language.json";
import React, { useCallback } from "react";

const removeTrailingSlash = (path: string) => {
  if (!config.site.trailing_slash) {
    return path.replace(/\/$/, "");
  }
  return path;
};

const LanguageSwitcher = ({
  lang,
  pathname,
}: {
  lang: string;
  pathname: string;
}) => {
  const { default_language, default_language_in_subdir } = config.settings;

  // Sort languages by weight and filter out disabled languages
  const sortedLanguages = languages
    .filter(
      (language) =>
        !(config.settings.disable_languages as string[]).includes(language.languageCode),
    )
    .toSorted((a, b) => a.weight - b.weight);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedLang = e.target.value;
      let newPath;
      const baseUrl = window.location.origin;

      if (selectedLang === default_language) {
        if (default_language_in_subdir) {
          newPath = `${baseUrl}/${default_language}${removeTrailingSlash(pathname.replace(`/${lang}`, ""))}`;
        } else {
          newPath = `${baseUrl}${removeTrailingSlash(pathname.replace(`/${lang}`, ""))}`;
        }
      } else {
        newPath = `/${selectedLang}${removeTrailingSlash(pathname.replace(`/${lang}`, ""))}`;
      }

      window.location.href = newPath;
    },
    [default_language, default_language_in_subdir, lang, pathname],
  );

  return (
    <div className={`mr-5 ${sortedLanguages.length > 1 ? "block" : "hidden"}`}>
      <select
        className="border border-border text-text-dark bg-white/70 py-1 rounded-sm cursor-pointer focus:ring-0 focus:border-primary dark:border-darkmode-border dark:text-darkmode-text-dark dark:bg-darkmode-body dark:focus:border-darkmode-primary"
        onChange={handleLanguageChange}
        value={lang}
      >
        {sortedLanguages.map((language) => (
          <option key={language.languageCode} value={language.languageCode}>
            {language.languageName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
