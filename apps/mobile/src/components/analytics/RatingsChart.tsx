import { StyleSheet, View } from "react-native";
import { Bar, CartesianChart } from "victory-native";
import { type SkFont } from "@shopify/react-native-skia";
import { buildAxisLabelRenderer, formatSeriesTick, getTickCount, type SeriesDatum } from "./chartUtils";

type RatingsSeriesDatum = SeriesDatum & { color?: string };

type Props = {
  data: RatingsSeriesDatum[];
  maxY: number;
  colors: { primary: string; border: string; muted: string };
  axisFont?: SkFont | null;
  height?: number;
  yLabel: string;
};

export function RatingsChart({ data, maxY, colors, axisFont, yLabel, height = 240 }: Props) {
  return (
    <View style={[styles.chartContainer, { height }]}>
      <CartesianChart
        data={data}
        xKey="index"
        yKeys={["value"]}
        padding={12}
        domainPadding={{ left: 32, right: 32, top: 24, bottom: 0 }}
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
        {({ points, chartBounds }) =>
          points.value.map((pt, idx) => (
            <Bar
              key={idx}
              points={[pt]}
              chartBounds={chartBounds}
              color={data[idx]?.color ?? colors.primary}
              roundedCorners={{ topLeft: 4, topRight: 4, bottomLeft: 2, bottomRight: 2 }}
              barWidth={52}
              barCount={data.length}
            />
          ))
        }
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: { height: 240 },
});
