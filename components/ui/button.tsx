import { Pressable, Text, ActivityIndicator, StyleSheet, View } from "react-native";

type Variant = "default" | "outline" | "ghost";

type Props = {
  onPress: () => void;
  label: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({
  onPress,
  label,
  variant = "default",
  loading = false,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === "default" && styles.default,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === "default" ? "#fff" : "#000"}
            style={{ marginRight: 8 }}
          />
        )}
        <Text
          style={[
            styles.label,
            variant === "outline" && styles.labelOutline,
            variant === "ghost" && styles.labelGhost,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  default: {
    backgroundColor: "#18181b",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  labelOutline: {
    color: "#18181b",
  },
  labelGhost: {
    color: "#71717a",
  },
});
