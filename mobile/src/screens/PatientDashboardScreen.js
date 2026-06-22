import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function PatientDashboardScreen({
  user,
  onLogout,
  onOpenAppointments,
  onOpenDentalRecords,
  onOpenXrays,
  onOpenARBraces,
  onOpenClinicDiscovery,
  onOpenProfile,
}) {
  const patientName = user?.name || "Patient";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.userBlock}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{patientName}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={18} color="#2b6cb0" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconCircle}>
          <Ionicons name="medical-outline" size={30} color="#2b6cb0" />
        </View>

        <View style={styles.heroTextBlock}>
          <Text style={styles.heroTitle}>Your Dental Care Portal</Text>
          <Text style={styles.heroText}>
            Manage appointments, records, X-rays, AR previews, nearby clinics,
            and your patient profile.
          </Text>
        </View>
      </View>

      <View style={styles.quickStatsRow}>
        <View style={styles.quickStatCard}>
          <Ionicons name="calendar-outline" size={18} color="#2b6cb0" />
          <Text style={styles.quickStatText}>Appointments</Text>
        </View>

        <View style={styles.quickStatCard}>
          <Ionicons name="document-text-outline" size={18} color="#2b6cb0" />
          <Text style={styles.quickStatText}>Records</Text>
        </View>

        <View style={styles.quickStatCard}>
          <Ionicons name="location-outline" size={18} color="#2b6cb0" />
          <Text style={styles.quickStatText}>Clinics</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Patient Tools</Text>
        <Text style={styles.sectionSubtitle}>Choose what you want to manage</Text>
      </View>

      <View style={styles.grid}>
        <FeatureCard
          icon="calendar-outline"
          title="Appointments"
          description="Book, cancel, and request reschedules."
          onPress={onOpenAppointments}
        />

        <FeatureCard
          icon="document-text-outline"
          title="Dental Records"
          description="View tooth chart and treatment history."
          onPress={onOpenDentalRecords}
        />

        <FeatureCard
          icon="image-outline"
          title="X-rays"
          description="View images and AI annotations."
          onPress={onOpenXrays}
        />

        <FeatureCard
          icon="happy-outline"
          title="AR Braces"
          description="Review saved braces previews."
          onPress={onOpenARBraces}
        />

        <FeatureCard
          icon="location-outline"
          title="Clinics"
          description="Find nearby dental clinics."
          onPress={onOpenClinicDiscovery}
        />

        <FeatureCard
          icon="person-outline"
          title="Profile"
          description="Update your patient information."
          onPress={onOpenProfile}
        />
      </View>
    </ScrollView>
  );
}

function FeatureCard({ icon, title, description, onPress }) {
  return (
    <Pressable style={styles.featureCard} onPress={onPress}>
      <View style={styles.featureTopRow}>
        <View style={styles.featureIconCircle}>
          <Ionicons name={icon} size={22} color="#2b6cb0" />
        </View>

        <Ionicons name="chevron-forward" size={18} color="#a0aec0" />
      </View>

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
    paddingBottom: 38,
  },
  header: {
    marginTop: 10,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  userBlock: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    color: "#718096",
    fontWeight: "700",
    marginBottom: 2,
  },
  name: {
    fontSize: 27,
    fontWeight: "900",
    color: "#1a202c",
  },
  logoutButton: {
    backgroundColor: "#edf2f7",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logoutText: {
    color: "#2b6cb0",
    fontSize: 13,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: "#2b6cb0",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    shadowColor: "#2b6cb0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  heroIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroText: {
    color: "#e3f2fd",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  quickStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 17,
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickStatText: {
    marginTop: 6,
    color: "#4a5568",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureCard: {
    width: "48%",
    minHeight: 158,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featureTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  featureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 7,
  },
  featureDescription: {
    fontSize: 12.5,
    color: "#718096",
    lineHeight: 18,
    fontWeight: "600",
  },
});