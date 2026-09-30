export const Platform = {
  OS: 'test',
  select: (options: Record<string, unknown>) =>
    options.test ?? options.default ?? options.ios ?? options.android,
};
