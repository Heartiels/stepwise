import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { addTask, listTasks, Task } from "../../src/db/taskRepo";
import { initDb } from "../../src/db/schema";

export default function HomeScreen() {
  const [title, setTitle] = useState("");
  const [tick, setTick] = useState(0);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // 保险：即使 RootLayout 没跑到，这里也能建表
    initDb();
    setDbReady(true);
  }, []);

  const tasks = useMemo(() => {
    if (!dbReady) return [];
    try {
      return listTasks();
    } catch (e) {
      // 如果极端情况下还是没建好表，返回空数组避免崩
      return [];
    }
  }, [dbReady, tick]);

  const onAdd = () => {
    const id = addTask(title);
    if (!id) return;
    setTitle("");
    setTick((x) => x + 1);
  };

  if (!dbReady) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text style={{ fontSize: 16 }}>Initializing database...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Stepwise</Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Add a new task..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <Pressable
          onPress={onAdd}
          style={{
            backgroundColor: "black",
            paddingHorizontal: 14,
            justifyContent: "center",
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Add</Text>
        </Pressable>
      </View>

      <FlatList<Task>
        data={tasks}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: "#666", marginTop: 4 }}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={{ color: "#666" }}>No tasks yet. Add one above.</Text>
        }
      />
    </View>
  );
}
