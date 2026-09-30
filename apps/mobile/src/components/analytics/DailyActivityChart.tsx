import { StyleSheet, View } from "react-native";
import { Bar, CartesianChart } from "victory-native";
import { type SkFont } from "@shopify/react-native-skia";
import { buildAxisLabelRenderer, formatSeriesTick, getTickCount, type SeriesDatum } from "./chartUtils";

type Props = {
  data: SeriesDatum[];
  maxY: number;
  yLabel: string;
  colors: { primary: string; border: string; muted: string };
  axisFont?: SkFont | null;
  height?: number;
};

export function DailyActivityChart({ data, maxY, yLabel, colors, axisFont, height = 240 }: Props) {
  return (
    <View style={[styles.chartContainer, { height }]}>
      <CartesianChart
        data={data}
        xKey="index"
        yKeys={["value"]}
        padding={{ left: 12, right: 12, top: 12, bottom: 12 }}
        domainPadding={{ left: 12, right: 12, top: 12, bottom: 0 }}
        axisOptions={{
          axisSide: { x: "bottom", y: "left" },
          labelColor: { x: colors.muted, y: colors.muted },
          lineColor: { grid: { x: colors.border, y: colors.border }, frame: colors.border },
          tickCount: { x: getTickCount(data.length), y: 4 },
          labelPosition: { x: "outset", y: "outset" },
          labelOffset: { x: 18, y: 18 },
          formatXLabel: formatSeriesTick(data),
          formatYLabel: (value?: number | null) => `${value ?? 0}`,
          domain: [0, Math.max(maxY, 1)],
          font: axisFont ?? undefined,
        }}
        renderOutside={buildAxisLabelRenderer({ font: axisFont, color: colors.muted, yLabel })}
      >
        {({ points, chartBounds }) => (
          <Bar
            points={points.value}
            chartBounds={chartBounds}
            color={colors.primary}
            roundedCorners={{ topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 }}
          />
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: { height: 240 },
});
