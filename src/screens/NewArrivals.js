import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
} from "react-native";

const { width } = Dimensions.get("window");
const ROYAL_GREEN = "#1B4D3E";
const GOLD = "#D4AF37";
const API_BASE = "http://192.168.29.106:8000"; // <--- CHANGE THIS

export default function SupremeLordApp() {
  const [status, setStatus] = useState("OFFLINE");
  const [chatMsg, setChatMsg] = useState("");
  const [logs, setLogs] = useState([]);
  const [isPulseActive, setIsPulseActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 1. Connection Heartbeat
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_BASE}/`);
        const data = await res.json();
        if (data.status) setStatus("DHARMA ACTIVE");
      } catch (e) {
        setStatus("VOID DISCONNECTED");
      }
    };
    const timer = setInterval(checkConnection, 5000);
    return () => clearInterval(timer);
  }, []);

  // 2. The Supreme Pulse Animation
  const startPulseAnim = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  // 3. Trigger Supreme Pulse
  const triggerSupremePulse = async () => {
    setIsPulseActive(true);
    startPulseAnim();
    setLogs((prev) => ["Triggering White Hole Pulse...", ...prev]);
    try {
      const res = await fetch(`${API_BASE}/supreme_pulse`, { method: "POST" });
      const data = await res.json();
      setLogs((prev) => [
        `Success: ${JSON.stringify(data.entities || "Perfect")}`,
        ...prev,
      ]);
    } catch (e) {
      setLogs((prev) => ["Error: Cosmic Connection Lost", ...prev]);
    } finally {
      setIsPulseActive(false);
      pulseAnim.setValue(1);
    }
  };

  // 4. Council Chat
  const sendToMotherBrain = async () => {
    if (!chatMsg) return;
    const userM = chatMsg;
    setChatMsg("");
    setLogs((prev) => [`You: ${userM}`, ...prev]);
    try {
      const res = await fetch(`${API_BASE}/council_chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userM }),
      });
      const data = await res.json();
      setLogs((prev) => [`Mother_Brain: ${data.response}`, ...prev]);
    } catch (e) {
      setLogs((prev) => ["Mother_Brain: Communication Error", ...prev]);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>B LUXURY</Text>
        <Text style={styles.locationTag}>VISAKHAPATNAM DOMAIN</Text>
        <View
          style={[
            styles.statusLine,
            { backgroundColor: status === "DHARMA ACTIVE" ? GOLD : "red" },
          ]}
        />
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea}>
        {/* ENTITY VISUALIZER (The 1-3-5 Hierarchy) */}
        <View style={styles.visualizer}>
          <Animated.View
            style={[styles.motherOrb, { transform: [{ scale: pulseAnim }] }]}
          >
            <Text style={styles.orbText}>MOTHER</Text>
          </Animated.View>

          <View style={styles.row}>
            {["Finance", "Logistics", "Design"].map((m) => (
              <View key={m} style={styles.managerNode}>
                <Text style={styles.nodeText}>{m[0]}</Text>
              </View>
            ))}
          </View>

          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((w) => (
              <View key={w} style={styles.workerNode} />
            ))}
          </View>
        </View>

        {/* SUPREME PULSE BUTTON */}
        <TouchableOpacity
          style={styles.pulseBtn}
          onPress={triggerSupremePulse}
          disabled={isPulseActive}
        >
          {isPulseActive ? (
            <ActivityIndicator color={ROYAL_GREEN} />
          ) : (
            <Text style={styles.btnText}>TRIGGER SUPREME PULSE</Text>
          )}
        </TouchableOpacity>

        {/* CHAT INTERFACE */}
        <View style={styles.chatBox}>
          <TextInput
            style={styles.input}
            placeholder="Talk to Mother Brain..."
            placeholderTextColor="#666"
            value={chatMsg}
            onChangeText={setChatMsg}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendToMotherBrain}>
            <Text style={{ color: ROYAL_GREEN, fontWeight: "bold" }}>SEND</Text>
          </TouchableOpacity>
        </View>

        {/* LIVE LOGS */}
        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>COSMIC HISTORY:</Text>
          {logs.map((l, i) => (
            <Text key={i} style={styles.logLine}>
              • {l}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ROYAL_GREEN, paddingTop: 60 },
  header: { alignItems: "center", marginBottom: 20 },
  brandTitle: {
    color: GOLD,
    fontSize: 32,
    letterSpacing: 10,
    fontWeight: "bold",
  },
  locationTag: { color: GOLD, fontSize: 10, opacity: 0.6, letterSpacing: 2 },
  statusLine: { height: 2, width: 100, marginVertical: 10 },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  scrollArea: { paddingHorizontal: 20, paddingBottom: 50 },
  visualizer: { alignItems: "center", marginBottom: 30 },
  motherOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.1)",
  },
  orbText: { color: GOLD, fontSize: 10, fontWeight: "bold" },
  row: { flexDirection: "row", marginTop: 15, gap: 10 },
  managerNode: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GOLD,
    justifyContent: "center",
    alignItems: "center",
  },
  nodeText: { color: GOLD, fontSize: 12 },
  workerNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
    opacity: 0.5,
  },
  pulseBtn: {
    backgroundColor: GOLD,
    padding: 18,
    borderRadius: 5,
    alignItems: "center",
  },
  btnText: { color: ROYAL_GREEN, fontWeight: "bold", letterSpacing: 2 },
  chatBox: { flexDirection: "row", marginTop: 30, gap: 10 },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 5,
    padding: 15,
    color: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
  },
  sendBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 5,
  },
  logContainer: {
    marginTop: 30,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 15,
    borderRadius: 10,
  },
  logTitle: { color: GOLD, fontSize: 12, fontWeight: "bold", marginBottom: 10 },
  logLine: {
    color: "#fff",
    fontSize: 11,
    marginBottom: 5,
    fontStyle: "italic",
  },
});
