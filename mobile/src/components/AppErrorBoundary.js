import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.error("DentoGraph mobile render error:", error, info);
    }
  }

  resetApplication = () => {
    this.setState({
      hasError: false,
    });

    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="warning-outline" size={34} color="#b91c1c" />
        </View>

        <Text style={styles.title}>DentoGraph encountered a problem</Text>

        <Text style={styles.message}>
          The current screen could not be displayed safely. Your account and
          saved records were not changed.
        </Text>

        <Pressable style={styles.primaryButton} onPress={this.resetApplication}>
          <Text style={styles.primaryButtonText}>Return to Home</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  iconCircle: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 34,
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    maxWidth: 330,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 22,
    backgroundColor: "#2563eb",
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
});
