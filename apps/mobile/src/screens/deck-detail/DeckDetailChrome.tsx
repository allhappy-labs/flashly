import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Canvas, LinearGradient, Rect, vec } from "@shopify/react-native-skia";

function toTransparent(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "transparent";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

function FadeOverlay(props: Readonly<{ color: string }>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!width || !height) {
      return;
    }
    setSize({ width, height });
  };

  return (
    <View style={styles.fadeOverlay} onLayout={handleLayout} pointerEvents="none">
      {size.width && size.height ? (
        <Canvas style={{ width: size.width, height: size.height }}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(size.width, 0)}
              colors={[toTransparent(props.color), props.color]}
            />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}

export function FadeScrollRow(props: Readonly<{
  children: React.ReactNode;
  backgroundColor: string;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const showFade = contentWidth > containerWidth + 4;

  return (
    <View style={styles.fadeWrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={props.contentStyle}
        onContentSizeChange={(width) => setContentWidth(width)}
      >
        {props.children}
      </ScrollView>
      {showFade ? <FadeOverlay color={props.backgroundColor} /> : null}
    </View>
  );
}

export function DeckDetailMenu(props: Readonly<{
  color: string;
  onImport: () => void;
  onExport: () => void;
  onDelete: () => void;
  labels: Readonly<{ import: string; export: string; delete: string }>;
  insets: Readonly<{ top: number }>;
}>) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"import" | "export" | "delete" | null>(null);

  const handleDismiss = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action === "import") props.onImport();
    if (action === "export") props.onExport();
    if (action === "delete") props.onDelete();
  };

  return (
    <View style={styles.menuRoot} pointerEvents="box-none">
      <TouchableOpacity
        onPress={() => setOpen((value) => !value)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.menuButton}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={props.color} />
      </TouchableOpacity>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onDismiss={handleDismiss}
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: (props.insets.top ?? 0) + 44, right: 12 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPendingAction("import");
                setOpen(false);
              }}
            >
              <Text style={styles.menuText}>{props.labels.import}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPendingAction("export");
                setOpen(false);
              }}
            >
              <Text style={styles.menuText}>{props.labels.export}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setPendingAction("delete");
                setOpen(false);
              }}
            >
              <Text style={[styles.menuText, styles.menuTextDanger]}>{props.labels.delete}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  menuRoot: { position: "relative" },
  menuButton: { paddingHorizontal: 6, paddingVertical: 4 },
  modalBackdrop: { flex: 1 },
  menu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    gap: 4,
    position: "absolute",
    minWidth: 160,
  },
  menuItem: { paddingVertical: 6 },
  menuText: { fontWeight: "600", color: "#111827" },
  menuTextDanger: { color: "#b91c1c" },
  fadeWrap: { position: "relative", overflow: "hidden" },
  fadeOverlay: { position: "absolute", right: 0, top: 0, bottom: 0, width: 32 },
});
