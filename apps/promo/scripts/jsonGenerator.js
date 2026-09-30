import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const languagesPath = new URL("../src/config/language.json", import.meta.url);
const languages = JSON.parse(fs.readFileSync(languagesPath, "utf8"));

const JSON_FOLDER = "./.json";
const CONTENT_ROOT = "src/content";
const CONTENT_SECTIONS = [
  {
    folder: "resources",
    routeSegment: "resources",
    group: "resources",
  },
  {
    folder: "help",
    routeSegment: "help-center",
    group: "help-center",
  },
];

const buildSlug = (filepath, data, section) => {
  if (data.slug) {
    const slugParts = data.slug.replace(/^\/+/, "").split("/");
    slugParts[0] = section.routeSegment;
    return slugParts.join("/");
  }

  const relativePath = path.relative(CONTENT_ROOT, filepath);
  const pathParts = relativePath.split(path.sep);
  const slugBase = pathParts
    .slice(2)
    .join("/")
    .replace(/\.[^/.]+$/, "");
  return `${section.routeSegment}/${slugBase}`;
};

const collectFiles = (dir, langIndex, section) => {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name.startsWith("-")) {
        return [];
      }

      const filepath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(filepath, langIndex, section);
      }

      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) {
        return [];
      }

      const file = fs.readFileSync(filepath, "utf-8");
      const { data, content } = matter(file);
      const slug = buildSlug(filepath, data, section);
      data.slug = slug;

      return {
        lang: languages[langIndex].languageCode,
        group: section.group,
        slug: data.slug,
        frontmatter: data,
        content: content,
      };
    });
};

// get data from markdown
const getData = (section) => {
  const getPaths = languages
    .map((lang, index) => {
      const langFolder = lang.contentDir ? lang.contentDir : lang.languageCode;
      const dir = path.join(CONTENT_ROOT, section.folder, langFolder);
      if (!fs.existsSync(dir)) {
        return [];
      }
      return collectFiles(dir, index, section);
    })
    .flat();

  return getPaths.filter((page) => !page.frontmatter?.draft && page);
};

try {
  // create folder if it doesn't exist
  if (!fs.existsSync(JSON_FOLDER)) {
    fs.mkdirSync(JSON_FOLDER);
  }

  // create json files
  fs.writeFileSync(
    `${JSON_FOLDER}/posts.json`,
    JSON.stringify(CONTENT_SECTIONS.flatMap((section) => getData(section))),
  );

  // merge json files for search
  const postsPath = new URL(`../${JSON_FOLDER}/posts.json`, import.meta.url);
  const posts = JSON.parse(fs.readFileSync(postsPath, "utf8"));
  const search = [...posts];
  fs.writeFileSync(`${JSON_FOLDER}/search.json`, JSON.stringify(search));
} catch (err) {
  console.error(err);
}
