import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "dentograph_patient_session_v1";

const normalizeUser = (user) => {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    ...user,
    role: String(user.role || "").trim(),
  };
};

export const isPatientUser = (user) =>
  String(user?.role || "").trim().toLowerCase() === "patient";

export const savePatientSession = async ({ token, user }) => {
  const normalizedToken = String(token || "").trim();
  const normalizedUser = normalizeUser(user);

  if (!normalizedToken || !normalizedUser) {
    throw new Error("A valid token and user are required to save a session.");
  }

  if (!isPatientUser(normalizedUser)) {
    throw new Error("The mobile application is restricted to Patient accounts.");
  }

  const session = {
    token: normalizedToken,
    user: normalizedUser,
    saved_at: new Date().toISOString(),
  };

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return session;
};

export const loadPatientSession = async () => {
  const storedValue = await SecureStore.getItemAsync(SESSION_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const session = JSON.parse(storedValue);

    if (!session?.token || !session?.user || !isPatientUser(session.user)) {
      await clearPatientSession();
      return null;
    }

    return {
      token: String(session.token),
      user: normalizeUser(session.user),
      saved_at: session.saved_at || null,
    };
  } catch (error) {
    await clearPatientSession();
    return null;
  }
};

export const updateStoredPatientUser = async (updatedUser) => {
  const currentSession = await loadPatientSession();

  if (!currentSession) {
    return null;
  }

  return savePatientSession({
    token: currentSession.token,
    user: {
      ...currentSession.user,
      ...updatedUser,
    },
  });
};

export const clearPatientSession = async () => {
  await SecureStore.deleteItemAsync(SESSION_KEY);
};