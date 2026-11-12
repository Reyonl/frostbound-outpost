"""Verify Phase G1 across multiple aspect ratios and quality settings."""

import json
from pathlib import Path
from capture_screen import capture

viewports = [
    ("g1_after_390x844", 390, 844),
    ("g1_after_360x800", 360, 800),
    ("g1_after_412x915", 412, 915),
    ("g1_after_575x1280", 575, 1280),
]

results = []
for name, w, h in viewports:
    res = capture(name, width=w, height=h, dpr=2.0, wait_sec=2.2)
    results.append({
        "name": name,
        "viewport": f"{w}x{h}",
        "quality": res["state"].get("quality"),
        "rendererCalls": res["state"].get("rendererCalls"),
        "severe_errors": len(res.get("severe_logs", [])),
        "screenshot": res["screenshot"],
    })

print("\n=== PHASE G1 VERIFICATION SUMMARY ===")
print(json.dumps(results, indent=2))
