import { slugify } from "@/lib/utils/textConverter";

type TaxonomyPost = {
  data: Record<string, unknown>;
};

const taxonomyFilter = <T extends TaxonomyPost>(
  posts: T[],
  name: string,
  key: string,
) =>
  posts.filter((post) => {
    const taxonomyValues = post.data[name];
    if (!Array.isArray(taxonomyValues) || !taxonomyValues.every((entry) => typeof entry === "string")) {
      return false;
    }
    return taxonomyValues.map((entry) => slugify(entry)).includes(key);
  });

export default taxonomyFilter;
