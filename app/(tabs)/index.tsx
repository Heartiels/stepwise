import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { addTask, listTasks, type Task } from "../../src/db/taskRepo";

export default function HomeScreen() {
  const [title, setTitle] = useState("");
  const [tick, setTick] = useState(0);

  const tasks = useMemo<Task[]>(() => {
    try {
      return listTasks();
    } catch (e: any) {
      console.log("listTasks failed:", e?.message ?? e);
      return [];
    }
  }, [tick]);

  useEffect(() => {
    // 初次触发一次加载
    setTick((x) => x + 1);
  }, []);

  function refresh() {
    setTick((x) => x + 1);
  }

  function onAdd() {
    const id = addTask(title);
    if (!id) {
      Alert.alert("请输入任务标题");
      return;
    }
    setTitle("");
    refresh();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Stepwise</Text>

      <View style={styles.row}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Add a task..."
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={onAdd}
        />
        <Pressable onPress={onAdd} style={styles.btn}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>

      {tasks.length === 0 ? (
        <Text style={styles.empty}>No tasks yet. Add one above.</Text>
      ) : (
        <View style={styles.list}>
          {tasks.map((t) => (
            <View key={t.id} style={styles.item}>
              <Text style={styles.itemTitle}>{t.title}</Text>
              <Text style={styles.itemMeta}>
                {new Date(t.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: "#fff" },
  h1: { fontSize: 38, fontWeight: "800", marginBottom: 18 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: "#000",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  empty: { marginTop: 12, color: "#888", fontSize: 16 },
  list: { marginTop: 16, gap: 12 },
  item: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    backgroundColor: "#fafafa",
  },
  itemTitle: { fontSize: 16, fontWeight: "700" },
  itemMeta: { marginTop: 4, fontSize: 12, color: "#999" },
});
