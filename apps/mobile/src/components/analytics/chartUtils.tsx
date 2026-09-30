import { Text as SkiaText, type SkFont } from "@shopify/react-native-skia";
import type { ReactNode } from "react";

export type SeriesDatum = { index: number; value: number; label: string };

export function formatSeriesTick(series: SeriesDatum[]) {
  return (value: number | string) => {
    const idx = typeof value === "number" ? Math.round(value) : Number(value);
    return series[idx]?.label ?? "";
  };
}

export function getTickCount(length: number) {
  if (length <= 0) return 0;
  if (length <= 4) return length;
  return 6;
}

export function buildAxisLabelRenderer({
  font,
  color,
  xLabel,
  yLabel,
}: {
  font?: SkFont | null;
  color: string;
  xLabel?: string | null;
  yLabel?: string | null;
}) {
  if (!font || (!xLabel && !yLabel)) return undefined;

  const measureText = (text: string) => {
    const ids = font.getGlyphIDs(text);
    const widths = font.getGlyphWidths(ids);
    return widths.reduce((sum, w) => sum + w, 0);
  };

  return ({ chartBounds }: { chartBounds: { left: number; right: number; top: number; bottom: number } }) => {
    const fontSize = font.getSize();
    const nodes: ReactNode[] = [];
    if (yLabel) {
      nodes.push(
        <SkiaText key="y" text={yLabel} font={font} x={chartBounds.left + 4} y={chartBounds.top + fontSize + 2} color={color} />,
      );
    }
    if (xLabel) {
      const xCenter = (chartBounds.left + chartBounds.right) / 2;
      const xWidth = measureText(xLabel);
      nodes.push(
        <SkiaText key="x" text={xLabel} font={font} x={xCenter - xWidth / 2} y={chartBounds.bottom + fontSize + 6} color={color} />,
      );
    }
    return nodes;
  };
}
