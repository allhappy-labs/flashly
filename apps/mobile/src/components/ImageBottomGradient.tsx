import { Canvas, LinearGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

type Props = {
  color?: string;
  heightRatio?: number;
};

function toRgb(hex: string) {
  if (hex.startsWith("#") && hex.length === 7) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  return { r: 11, g: 18, b: 32 };
}

export default function ImageBottomGradient({ color = "#0b1220", heightRatio = 0.2 }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const base = color.startsWith("#") && color.length === 7 ? color : "#0b1220";
  const colors = useMemo(() => {
    const { r, g, b } = toRgb(base);
    const transparent = Skia.Color(`rgba(${r}, ${g}, ${b}, 0)`);
    const solid = Skia.Color(`rgba(${r}, ${g}, ${b}, 0.72)`);
    return { transparent, solid };
  }, [base]);

  return (
    <View
      style={[
        styles.overlay,
        { height: `${Math.min(Math.max(heightRatio, 0.2), 1) * 100}%` },
      ]}
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width === size.width && height === size.height) return;
        setSize({ width, height });
      }}
    >
      {size.width && size.height ? (
        <Canvas style={{ width: size.width, height: size.height }}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, size.height)}
              colors={[colors.transparent, colors.solid]}
            />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
