import { View, Text, StyleSheet, type ViewProps } from "react-native";

type CardProps = ViewProps & { children: React.ReactNode };

export function Card({ style, children, ...props }: CardProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <Text style={styles.content}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#18181b",
    marginBottom: 4,
  },
  content: {
    fontSize: 13,
    color: "#71717a",
    lineHeight: 18,
  },
});
