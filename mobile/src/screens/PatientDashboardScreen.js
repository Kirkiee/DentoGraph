import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function PatientDashboardScreen({
  user,
  token,
  onLogout,
  onOpenAppointments,
  onOpenDentalRecords,
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user?.name || "Patient"}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Your Dental Care Portal</Text>
        <Text style={styles.heroText}>
          View your appointments, dental records, X-rays, and upcoming treatment
          updates in one place.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Patient Tools</Text>

      <View style={styles.grid}>
        <FeatureCard
          title="Appointments"
          description="View, book, cancel, and request reschedules."
          onPress={onOpenAppointments}
        />

        <FeatureCard
          title="Dental Records"
          description="Check your tooth chart and treatment notes."
          onPress={onOpenDentalRecords}
        />

        <FeatureCard
          title="X-rays"
          description="View uploaded dental images and annotations."
        />

        <FeatureCard
          title="AR Braces"
          description="Preview braces visualization soon."
        />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Mobile App Status</Text>
        <Text style={styles.statusText}>
          Appointments and dental records are now connected. Next step is adding
          patient X-rays.
        </Text>
      </View>
    </ScrollView>
  );
}

function FeatureCard({ title, description, onPress }) {
  return (
    <Pressable style={styles.featureCard} onPress={onPress}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginTop: 12,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontSize: 15,
    color: "#718096",
  },
  name: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a202c",
  },
  logoutButton: {
    backgroundColor: "#edf2f7",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  logoutText: {
    color: "#2b6cb0",
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: "#2b6cb0",
    borderRadius: 24,
    padding: 22,
    marginBottom: 26,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroText: {
    color: "#e3f2fd",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a202c",
    marginBottom: 14,
  },
  grid: {
    gap: 14,
  },
  featureCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a202c",
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginTop: 22,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  statusText: {
    fontSize: 14,
    color: "#4a5568",
    lineHeight: 20,
  },
});