import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useFocusOnNavigate() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: false });
    }
  }, [pathname]);
}
