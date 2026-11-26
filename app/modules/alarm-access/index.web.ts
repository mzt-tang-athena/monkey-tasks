/** Web has no notification channels, so the phone's access never matters. */
const alarmAccess = {
  hasDndAccess: () => false,
  openDndAccess: () => undefined,
};

export default alarmAccess;
