import { Linking, Platform } from "react-native";
import { Camera } from "expo-camera";
import * as Location from "expo-location";

export const PERMISSION_STATUS = {
  GRANTED: "granted",
  DENIED: "denied",
  BLOCKED: "blocked",
  UNDETERMINED: "undetermined",
};

const normalizePermission = (permission) => {
  if (permission?.status === "granted") {
    return {
      status: PERMISSION_STATUS.GRANTED,
      granted: true,
      canAskAgain: Boolean(permission.canAskAgain),
    };
  }

  if (permission?.status === "undetermined") {
    return {
      status: PERMISSION_STATUS.UNDETERMINED,
      granted: false,
      canAskAgain: permission.canAskAgain !== false,
    };
  }

  return {
    status:
      permission?.canAskAgain === false
        ? PERMISSION_STATUS.BLOCKED
        : PERMISSION_STATUS.DENIED,
    granted: false,
    canAskAgain: permission?.canAskAgain !== false,
  };
};

export const getCameraPermissionState = async () =>
  normalizePermission(await Camera.getCameraPermissionsAsync());

export const requestCameraPermission = async () =>
  normalizePermission(await Camera.requestCameraPermissionsAsync());

export const getLocationPermissionState = async () =>
  normalizePermission(await Location.getForegroundPermissionsAsync());

export const requestLocationPermission = async () =>
  normalizePermission(await Location.requestForegroundPermissionsAsync());

export const openApplicationSettings = async () => {
  if (Platform.OS === "ios") {
    await Linking.openURL("app-settings:");
    return;
  }

  await Linking.openSettings();
};

export const getPermissionMessage = ({
  permissionName,
  status,
  purpose,
}) => {
  if (status === PERMISSION_STATUS.BLOCKED) {
    return `${permissionName} access is blocked. Open device settings and allow access so DentoGraph can ${purpose}.`;
  }

  return `${permissionName} access is required so DentoGraph can ${purpose}.`;
};