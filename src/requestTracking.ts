export const REQUEST_TRACKING_EVENT = "mady-request-tracking-updated";

export const notifyRequestTrackingAvailable = () => {
  window.dispatchEvent(new Event(REQUEST_TRACKING_EVENT));
};
