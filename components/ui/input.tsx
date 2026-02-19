import { TextInput, StyleSheet, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
};

export function Input({ style, ...props }: Props) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor="#a1a1aa"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#18181b",
    backgroundColor: "#fafafa",
    width: "100%",
  },
});
