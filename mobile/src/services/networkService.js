import NetInfo from "@react-native-community/netinfo";

let latestNetworkState = {
  isConnected: true,
  isInternetReachable: true,
};

export const subscribeToNetworkStatus = (listener) =>
  NetInfo.addEventListener((state) => {
    latestNetworkState = {
      isConnected: state.isConnected !== false,
      isInternetReachable: state.isInternetReachable !== false,
    };

    listener?.(latestNetworkState);
  });

export const refreshNetworkStatus = async () => {
  const state = await NetInfo.fetch();

  latestNetworkState = {
    isConnected: state.isConnected !== false,
    isInternetReachable: state.isInternetReachable !== false,
  };

  return latestNetworkState;
};

export const getLatestNetworkStatus = () => latestNetworkState;

export const isDeviceOffline = () =>
  latestNetworkState.isConnected === false ||
  latestNetworkState.isInternetReachable === false;