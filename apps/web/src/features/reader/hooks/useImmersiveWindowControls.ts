import { useEffect } from "react";
import { setStatusBarHidden } from "../../../platform/status-bar";
import { setTrafficLightsVisible } from "../../../platform/traffic-lights";

/**
 * Keep native desktop traffic lights reachable while reading. The mobile
 * status bar follows immersive mode and returns on unmount.
 *
 * Restoration lives in its own mount-scoped effect rather than the sync effect's
 * cleanup, so toggling `visible` does not flash the chrome on/off.
 */
export function useImmersiveWindowControls(visible: boolean): void {
  useEffect(() => {
    void setTrafficLightsVisible(true);
    void setStatusBarHidden(!visible);
  }, [visible]);

  useEffect(() => {
    return () => {
      void setTrafficLightsVisible(true);
      void setStatusBarHidden(false);
    };
  }, []);
}
