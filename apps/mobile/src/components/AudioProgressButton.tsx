import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { getAudioPlaybackSnapshot, subscribeToAudioPlayback } from "../services/audioPlayer";

type AudioProgressButtonProps = Readonly<{
  uri: string;
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  size?: number;
  iconSize?: number;
  disabled?: boolean;
  onPress?: () => void;
}>;

export default function AudioProgressButton(props: AudioProgressButtonProps) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState(() => getAudioPlaybackSnapshot());
  const trimmedUri = props.uri?.trim();

  useEffect(() => {
    const unsubscribe = subscribeToAudioPlayback(setSnapshot);
    return () => {
      unsubscribe();
    };
  }, []);

  const isActive = Boolean(trimmedUri && snapshot.uri === trimmedUri);
  const isPlaying = isActive && snapshot.playing;
  const progress = isActive ? Math.min(1, Math.max(0, snapshot.progress)) : 0;
  const size = props.size ?? 34;
  const iconSize = props.iconSize ?? 16;
  const strokeWidth = Math.max(2, Math.round(size * 0.12));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <TouchableOpacity
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? t("flashcards.audioStop") : t("flashcards.audioPlay")}
      accessibilityState={{ disabled: props.disabled, selected: isPlaying }}
      style={[styles.button, { width: size, height: size }, props.disabled ? styles.disabled : null]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={props.borderColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={props.iconColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View
        style={[
          styles.iconShell,
          {
            backgroundColor: props.backgroundColor,
            borderColor: props.borderColor,
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            borderRadius: (size - strokeWidth * 2) / 2,
          },
        ]}
      >
        <Ionicons name={isPlaying ? "stop" : "play"} size={iconSize} color={props.iconColor} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconShell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
