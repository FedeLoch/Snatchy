/** Keeps the screen on while a long task runs, so Android does not lock the
 * phone and pause the analysis. Uses the native flag in the app (no
 * permission needed) and the Screen Wake Lock API on the web. Returns the
 * release function; failures are ignored because this is a convenience. */
export async function holdScreenOn(): Promise<() => void> {
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (!(await KeepAwake.isSupported()).isSupported) return () => {};
    await KeepAwake.keepAwake();
    return () => void KeepAwake.allowSleep().catch(() => undefined);
  } catch {
    return () => {};
  }
}
