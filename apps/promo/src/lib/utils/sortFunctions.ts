// sort by date
type DatedItem = {
  data: {
    date?: Date | string | null;
  };
};

type WeightedItem = {
  data: {
    weight?: number | null;
  };
};

const toDateValue = (value?: Date | string | null) => {
  if (value instanceof Date) {
    return value.valueOf();
  }
  if (typeof value === "string") {
    return new Date(value).valueOf();
  }
  return 0;
};

const hasWeight = <T extends WeightedItem>(
  item: T,
): item is T & { data: { weight: number } } =>
  typeof item.data.weight === "number";

export const sortByDate = <T extends DatedItem>(array: T[]) => {
  return array.toSorted(
    (a, b) => toDateValue(b.data.date) - toDateValue(a.data.date),
  );
};

// sort product by weight
export const sortByWeight = <T extends WeightedItem>(array: T[]) => {
  const withWeight = array.filter(hasWeight);
  const withoutWeight = array.filter((item) => !hasWeight(item));
  const sortedWeightedArray = withWeight.toSorted(
    (a, b) => a.data.weight - b.data.weight,
  );
  return [...new Set([...sortedWeightedArray, ...withoutWeight])];
};
