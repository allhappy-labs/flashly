import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

type Props = {
  progress: number; // 0..1
  height?: number;
  trackColor?: string;
  fillColor?: string;
  rounded?: boolean;
  style?: object;
};

export function ProgressBar({
  progress,
  height = 8,
  trackColor = "#e5e7eb",
  fillColor = "#111827",
  rounded = true,
  style,
}: Props) {
  const width = useSharedValue(progress);

  useEffect(() => {
    width.value = withTiming(progress, { duration: 320 });
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${Math.min(Math.max(width.value, 0), 1) * 100}%` }));

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: rounded ? height : 0 },
        style,
      ]}
    >
      <Animated.View
        style={[styles.fill, animatedStyle, { backgroundColor: fillColor, borderRadius: rounded ? height : 0 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});

export default ProgressBar;
