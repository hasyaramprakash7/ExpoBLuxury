import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import createAgoraRtcEngine, {
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
  IRtcEngine,
} from "react-native-agora";
import Ionicons from "@expo/vector-icons/Ionicons";

import { RootState } from "../app/store";
import {
  setIncomingCall,
  endCall,
  startCall,
} from "../features/chat/chatSlice";
import socket from "../userScreens/utils/socket";

const AGORA_APP_ID = "YOUR_AGORA_APP_ID"; // 🔥 Replace with your App ID from Agora Console

const { width, height } = Dimensions.get("window");

const CallManager: React.FC = () => {
  const dispatch = useDispatch();
  const { incomingCall, outgoingCall, isCallActive } = useSelector(
    (state: RootState) => state.chat,
  );

  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const engine = useRef<IRtcEngine | null>(null);

  // 1. Listen for Socket events (Ringing / Cancelled)
  useEffect(() => {
    socket.on("incomingCall", (data) => {
      dispatch(setIncomingCall(data));
    });

    socket.on("callAccepted", () => {
      if (outgoingCall) handleJoinChannel(outgoingCall);
    });

    socket.on("callDeclined", () => {
      Alert.alert("Call Declined", "The user declined your call.");
      handleEndCall();
    });

    socket.on("callEnded", () => {
      handleEndCall();
    });

    return () => {
      socket.off("incomingCall");
      socket.off("callAccepted");
      socket.off("callDeclined");
      socket.off("callEnded");
    };
  }, [outgoingCall, incomingCall]);

  // 2. Initialize Agora Engine
  const initAgora = async () => {
    if (engine.current) return;
    engine.current = createAgoraRtcEngine();
    engine.current.initialize({ appId: AGORA_APP_ID });

    engine.current.registerEventHandler({
      onJoinChannelSuccess: () => {
        dispatch(startCall());
      },
      onUserJoined: (_, uid) => {
        setRemoteUid(uid);
      },
      onUserOffline: () => {
        handleEndCall();
      },
    });
  };

  const handleJoinChannel = async (callData: any) => {
    await initAgora();
    const isVideo = callData.type === "video";
    setVideoEnabled(isVideo);

    if (isVideo) {
      engine.current?.enableVideo();
      engine.current?.startPreview();
    } else {
      engine.current?.enableAudio();
    }

    engine.current?.joinChannel(callData.token, callData.channelName, 0, {
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      socket.emit("acceptCall", { toCallerId: incomingCall.fromId });
      handleJoinChannel(incomingCall);
    }
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      socket.emit("declineCall", { toCallerId: incomingCall.fromId });
      dispatch(setIncomingCall(null));
    }
  };

  const handleEndCall = () => {
    // Notify other user
    const partnerId = incomingCall?.fromId || outgoingCall?.toId;
    if (partnerId) socket.emit("endCall", { toPartnerId: partnerId });

    engine.current?.leaveChannel();
    engine.current?.release();
    engine.current = null;
    setRemoteUid(null);
    dispatch(endCall());
  };

  const toggleMute = () => {
    engine.current?.muteLocalAudioStream(!isMuted);
    setIsMuted(!isMuted);
  };

  // --- UI RENDERING ---

  // 1. Incoming Call UI (Ringing)
  if (incomingCall && !isCallActive) {
    return (
      <Modal transparent animationType="slide">
        <View style={styles.ringingContainer}>
          <View style={styles.callerInfo}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>
                {incomingCall.fromName.charAt(0)}
              </Text>
            </View>
            <Text style={styles.callerName}>{incomingCall.fromName}</Text>
            <Text style={styles.callType}>
              Incoming {incomingCall.type} call...
            </Text>
          </View>
          <View style={styles.ringingButtons}>
            <TouchableOpacity
              onPress={handleDeclineCall}
              style={[styles.circleBtn, styles.declineBtn]}
            >
              <Ionicons name="close" size={35} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAcceptCall}
              style={[styles.circleBtn, styles.acceptBtn]}
            >
              <Ionicons name="call" size={35} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // 2. Active Call UI (Video/Audio tiles)
  if (isCallActive) {
    const activeData = incomingCall || outgoingCall;
    return (
      <Modal fullScreen animationType="fade">
        <SafeAreaView style={styles.activeCallContainer}>
          {activeData?.type === "video" ? (
            <View style={{ flex: 1 }}>
              {remoteUid ? (
                <RtcSurfaceView
                  canvas={{ uid: remoteUid }}
                  style={styles.remoteVideo}
                />
              ) : (
                <View style={styles.waitingContainer}>
                  <ActivityIndicator size="large" color="white" />
                  <Text style={styles.whiteText}>Connecting...</Text>
                </View>
              )}
              <RtcSurfaceView canvas={{ uid: 0 }} style={styles.localPreview} />
            </View>
          ) : (
            <View style={styles.audioOnlyContainer}>
              <Ionicons name="person-circle" size={120} color="#555" />
              <Text style={styles.whiteText}>
                {activeData?.fromName || "Voice Call"}
              </Text>
              <Text style={styles.statusText}>
                {remoteUid ? "Connected" : "Calling..."}
              </Text>
            </View>
          )}

          {/* Controls Bar */}
          <View style={styles.controlsBar}>
            <TouchableOpacity
              onPress={toggleMute}
              style={[styles.controlBtn, isMuted && { backgroundColor: "red" }]}
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={26}
                color="white"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEndCall}
              style={[
                styles.controlBtn,
                { backgroundColor: "#FF3B30", width: 70, height: 70 },
              ]}
            >
              <Ionicons
                name="call-outline"
                size={32}
                color="white"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn}>
              <Ionicons name="videocam-off" size={26} color="white" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  ringingContainer: {
    flex: 1,
    backgroundColor: "#075E54",
    justifyContent: "space-around",
    alignItems: "center",
  },
  callerInfo: { alignItems: "center" },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarText: { fontSize: 40, color: "white", fontWeight: "bold" },
  callerName: { fontSize: 28, color: "white", fontWeight: "bold" },
  callType: { fontSize: 16, color: "#eee", marginTop: 10 },
  ringingButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-evenly",
    marginBottom: 50,
  },
  circleBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: { backgroundColor: "#25D366" },
  declineBtn: { backgroundColor: "#FF3B30" },
  activeCallContainer: { flex: 1, backgroundColor: "#1a1a1a" },
  remoteVideo: { flex: 1 },
  localPreview: {
    width: 110,
    height: 160,
    position: "absolute",
    top: 50,
    right: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#444",
  },
  audioOnlyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controlsBar: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
  },
  controlBtn: {
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  whiteText: { color: "white", fontSize: 20, marginTop: 15 },
  statusText: { color: "#aaa", marginTop: 5 },
  waitingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default CallManager;
