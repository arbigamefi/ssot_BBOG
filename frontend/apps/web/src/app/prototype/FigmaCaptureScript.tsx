"use client";

import * as React from "react";

const SCRIPT_ID = "ag-figma-capture-script";
const SCRIPT_SRC = "https://mcp.figma.com/mcp/html-to-design/capture.js";

export function FigmaCaptureScript() {
  React.useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
