import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  refreshNetworkStatus,
  subscribeToNetworkStatus,
} from "../services/networkService";

export default function NetworkStatusBanner() {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
  });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(setNetworkState);
    refreshNetworkStatus().then(setNetworkState).catch(() => {});

    return unsubscribe;
  }, []);

  const offline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;

  if (!offline) {
    return null;
  }

  const retry = async () => {
    try {
      setChecking(true);
      const nextState = await refreshNetworkStatus();
      setNetworkState(nextState);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={19} color="#ffffff" />

      <View style={styles.textContainer}>
        <Text style={styles.title}>You are offline</Text>
        <Text style={styles.message}>
          Some DentoGraph features will be available again after reconnection.
        </Text>
      </View>

      <Pressable
        style={styles.retryButton}
        onPress={retry}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.retryText}>Retry</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#b45309",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  message: {
    marginTop: 2,
    color: "#ffedd5",
    fontSize: 10,
    lineHeight: 14,
  },
  retryButton: {
    minWidth: 55,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 9,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
});