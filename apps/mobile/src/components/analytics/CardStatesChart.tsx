import { StyleSheet, Text, View } from "react-native";
import { Pie, PolarChart } from "victory-native";

type CardStateDatum = {
  key: string;
  label: string;
  value: number;
  fill: string;
  percentage?: number;
};

type Props = {
  data: CardStateDatum[];
  colors: { text: string; muted?: string };
  height?: number;
  totalValue?: number;
  totalLabel?: string;
};

export function CardStatesChart({ data, colors, height = 220, totalValue, totalLabel }: Props) {
  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.chartWrap}>
        <PolarChart
          data={data.map((item) => ({ label: item.label, value: item.value, color: item.fill }))}
          labelKey="label"
          valueKey="value"
          colorKey="color"
          containerStyle={{ flex: 1 }}
        >
          <Pie.Chart innerRadius={56}>{() => <Pie.Slice />}</Pie.Chart>
        </PolarChart>
        {typeof totalValue === "number" ? (
          <View style={styles.centerLabel}>
            <Text style={[styles.centerValue, { color: colors.text }]}>{totalValue.toLocaleString()}</Text>
            {totalLabel ? (
              <Text style={[styles.centerCaption, { color: colors.muted ?? colors.text }]}>{totalLabel}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.legendColumn}>
        {data.map((item) => (
          <View key={item.key} style={styles.legendRow}>
            <View style={styles.legendLabel}>
              <View style={[styles.legendSwatch, { backgroundColor: item.fill }]} />
              <Text style={[styles.legendText, { color: colors.muted ?? colors.text }]}>{item.label}</Text>
            </View>
            <Text style={[styles.legendValue, { color: colors.text }]}>
              {item.percentage ? `${item.percentage}%` : "0%"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 220, flexDirection: "row", alignItems: "center", gap: 16 },
  chartWrap: { width: 150, height: 150 },
  centerLabel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerValue: { fontSize: 20, fontWeight: "800" },
  centerCaption: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", marginTop: 2 },
  legendColumn: { flex: 1, gap: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 13, fontWeight: "600" },
  legendValue: { fontSize: 16, fontWeight: "700" },
});
