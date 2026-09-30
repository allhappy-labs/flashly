import type { ContentEntryMap } from "astro:content";

export type Button = {
  enable: boolean;
  label: string;
  link: string;
};

export type FeatureItem = {
  title: string;
  content: string;
  icon: string;
};

export type PersonaItem = {
  title: string;
  content: string;
  link: string;
};
