import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { usePalette } from "../theme";

export type IconSelectOption = {
  value: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  iconBackground?: string;
};

type Props = {
  label?: string;
  options: IconSelectOption[];
  value: string;
  onChange: (value: string) => void;
};

export default function IconSelect({ label, options, value, onChange }: Props) {
  const colors = usePalette();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(value);

  useEffect(() => {
    setPendingValue(value);
  }, [value]);

  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? options[0], [options, value]);

  if (!selectedOption) return null;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: colors.muted }]}>{label}</Text> : null}
      {Platform.OS === "android" ? (
        <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Picker
            selectedValue={value}
            onValueChange={(nextValue) => onChange(String(nextValue))}
            dropdownIconColor={colors.muted}
            style={[styles.picker, { color: colors.text }]}
            itemStyle={{ color: colors.text }}
            mode="dropdown"
          >
            {options.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.selectorRow, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setOpen(true)}
          >
            <View
              style={[
                styles.selectorIcon,
                { backgroundColor: selectedOption.iconBackground ?? colors.background },
              ]}
            >
              <Ionicons
                name={selectedOption.icon}
                size={16}
                color={selectedOption.iconColor ?? colors.primary}
              />
            </View>
            <Text style={[styles.selectorLabel, { color: colors.text }]}>{selectedOption.label}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </TouchableOpacity>
          <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
            <View style={styles.pickerModalBackdrop}>
              <View style={[styles.pickerModal, { backgroundColor: colors.card }]}>
                <View style={[styles.pickerModalHeader, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Text style={[styles.pickerAction, { color: colors.muted }]}>{t("common.cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setOpen(false);
                      onChange(pendingValue);
                    }}
                  >
                    <Text style={[styles.pickerAction, { color: colors.primary }]}>{t("common.confirm")}</Text>
                  </TouchableOpacity>
                </View>
                <Picker
                  selectedValue={pendingValue}
                  onValueChange={(nextValue) => setPendingValue(String(nextValue))}
                  style={[styles.pickerModalControl, { color: colors.text }]}
                  itemStyle={{ color: colors.text }}
                >
                  {options.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  picker: { height: 44 },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  selectorIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorLabel: { fontWeight: "600", fontSize: 15, flex: 1 },
  pickerModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  pickerModal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerAction: { fontWeight: "600", fontSize: 16 },
  pickerModalControl: { height: 220 },
});
