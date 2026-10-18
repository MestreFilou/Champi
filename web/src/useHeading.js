import { useCallback, useEffect, useState } from 'react';

// Cap du téléphone (0 = nord) via la boussole. iPhone : autorisation à demander sur un geste.
// Android (Chrome) : « deviceorientationabsolute » donne un cap par rapport au nord magnétique.

const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

export function useHeading(active) {
  const [heading, setHeading] = useState(null);
  const [granted, setGranted] = useState(!needsPermission);

  const request = useCallback(async () => {
    try {
      setGranted((await DeviceOrientationEvent.requestPermission()) === 'granted');
    } catch {
      setGranted(false);
    }
  }, []);

  useEffect(() => {
    if (!active || !granted) return;
    const screenAngle = () => screen.orientation?.angle ?? 0;
    const onIos = (e) => e.webkitCompassHeading != null && setHeading((e.webkitCompassHeading + screenAngle()) % 360);
    const onAbsolute = (e) => e.alpha != null && setHeading((360 - e.alpha + screenAngle()) % 360);
    const absolute = 'ondeviceorientationabsolute' in window;
    window.addEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', absolute ? onAbsolute : onIos);
    return () => window.removeEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', absolute ? onAbsolute : onIos);
  }, [active, granted]);

  return { heading, needsPermission: needsPermission && !granted, request };
}
