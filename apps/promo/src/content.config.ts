import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const commonFields = {
  title: z.string(),
  description: z.string(),
  meta_title: z.string().optional(),
  date: z.date().optional(),
  image: z.string().optional(),
  draft: z.boolean(),
};

// Resources collection schema
const resourcesCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/resources" }),
  schema: z.object({
    ...commonFields,
    author: z.string().default("Admin"),
    categories: z.array(z.string()).default(["others"]),
    tags: z.array(z.string()).default(["others"]),
  }),
});

// Help collection schema
const helpCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/help" }),
  schema: z.object({
    ...commonFields,
    author: z.string().default("Admin"),
    categories: z.array(z.string()).default(["others"]),
    tags: z.array(z.string()).default(["others"]),
  }),
});

// Author collection schema
const authorsCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/authors" }),
  schema: z.object({
    ...commonFields,
    email: z.string().optional(),
    image: z.string().optional(),
    social: z
      .array(
        z
          .object({
            name: z.string().optional(),
            icon: z.string().optional(),
            link: z.string().optional(),
          })
          .optional(),
      )
      .optional(),
  }),
});

// Pages collection schema
const pagesCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/pages" }),
  schema: z.object({
    ...commonFields,
  }),
});

// about collection schema
const aboutCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/about" }),
  schema: z.object({
    ...commonFields,
  }),
});

// contact collection schema
const contactCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/contact" }),
  schema: z.object({
    ...commonFields,
  }),
});

// Homepage collection schema
const homepageCollection = defineCollection({
  loader: glob({ pattern: "**/-*.{md,mdx}", base: "src/content/homepage" }),
  schema: z.object({
    hero: z.object({
      title: z.string(),
      content: z.string(),
      image: z.string().optional(),
      primary_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      secondary_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      badges: z.array(
        z.object({
          label: z.string(),
          link: z.string(),
        }),
      ),
    }),
    feature_overview: z.object({
      title: z.string(),
      description: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
          icon: z.string(),
        }),
      ),
    }),
    generator: z.object({
      title: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      input_label: z.string(),
      output_label: z.string(),
      sample_input: z.string(),
      sample_output: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),
    personas: z.object({
      title: z.string(),
      description: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
          link: z.string(),
        }),
      ),
    }),
  }),
});

// Use case landing pages collection schema
const useCasesCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/use-cases" }),
  schema: z.object({
    ...commonFields,
    hero: z.object({
      eyebrow: z.string(),
      title: z.string(),
      content: z.string(),
      image: z.string().optional(),
      primary_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
      secondary_button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),
    feature_overview: z.object({
      title: z.string(),
      description: z.string(),
      items: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
          icon: z.string(),
        }),
      ),
    }),
    generator: z.object({
      title: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      input_label: z.string(),
      output_label: z.string(),
      sample_input: z.string(),
      sample_output: z.string(),
      button: z.object({
        enable: z.boolean(),
        label: z.string(),
        link: z.string(),
      }),
    }),
  }),
});

// Call to Action collection schema
const ctaSectionCollection = defineCollection({
  loader: glob({
    pattern: "*/call-to-action.{md,mdx}",
    base: "src/content/sections",
  }),
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
    button: z.object({
      enable: z.boolean(),
      label: z.string(),
      link: z.string(),
    }),
  }),
});

// Testimonials Section collection schema
const testimonialSectionCollection = defineCollection({
  loader: glob({
    pattern: "*/testimonial.{md,mdx}",
    base: "src/content/sections",
  }),
  schema: z.object({
    enable: z.boolean(),
    title: z.string(),
    description: z.string(),
    testimonials: z.array(
      z.object({
        name: z.string(),
        avatar: z.string(),
        designation: z.string(),
        content: z.string(),
      }),
    ),
  }),
});

// Export collections
export const collections = {
  // Pages
  homepage: homepageCollection,
  useCases: useCasesCollection,
  resources: resourcesCollection,
  help: helpCollection,
  authors: authorsCollection,
  pages: pagesCollection,
  about: aboutCollection,
  contact: contactCollection,

  // sections
  ctaSection: ctaSectionCollection,
  testimonialSection: testimonialSectionCollection,
};
