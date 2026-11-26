/**
 * The native AlarmAccess module in tests. Tests run on the host, which
 * has no Do Not Disturb access, so the app sees none unless a test sets
 * `granted` before the channels are made.
 */
const state = { granted: false };

export default {
  hasDndAccess: () => state.granted,
  openDndAccess: () => undefined,
};

export const alarmAccessStub = state;
