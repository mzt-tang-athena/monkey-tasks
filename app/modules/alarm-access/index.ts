import { requireNativeModule } from "expo-modules-core";

/**
 * The phone's Do Not Disturb access. An alarm channel keeps its
 * Do Not Disturb bypass only when the app holds this access as it
 * makes the channel, so the app asks before it picks a channel id.
 */
type AlarmAccess = {
  hasDndAccess(): boolean;
  /** Open the system screen where the operator grants the access. */
  openDndAccess(): void;
};

export default requireNativeModule<AlarmAccess>("AlarmAccess");
