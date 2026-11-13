"""Audit draw calls in High and Low quality, with per-category breakdown and screenshot capture."""

import argparse
import functools
import http.server
import json
import os
import shutil
import socketserver
import sys
import threading
import time
from pathlib import Path

# Remove outdated global npm chromedriver from PATH to let Selenium Manager use the matching driver
os.environ["PATH"] = ";".join(
    p for p in os.environ.get("PATH", "").split(";") if "npm" not in p.lower()
)

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def run_audit(prefix: str = "audit", high_budget: int = 130, low_budget: int = 85):
    root_dir = Path(__file__).resolve().parents[2]
    dist_dir = root_dir / "web_game" / "dist"
    evidence_dir = root_dir / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    brain_evidence_dir = Path(r"C:\Users\ThinkPad\.gemini\antigravity\brain\7baa4ddd-5634-4f6b-bae9-38cf9b6617b1\evidence")
    brain_evidence_dir.mkdir(parents=True, exist_ok=True)

    handler = functools.partial(QuietHandler, directory=str(dist_dir))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=410,890")
    opts.add_argument("--disable-gpu-sandbox")
    opts.add_argument("--use-gl=angle")
    opts.add_argument("--use-angle=swiftshader")
    opts.add_argument("--enable-webgl")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option(
        "mobileEmulation",
        {"deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2.0}, "userAgent": "Mozilla/5.0 Pixel 7"},
    )
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(f"http://127.0.0.1:{port}/?debug=1")
        quality_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".hud-quality-btn"))
        )
        time.sleep(2.0)

        # 1. High Quality audit
        high_state = driver.execute_script("return window.__frostboundDebug.getState();")
        high_breakdown = driver.execute_script(
            "return window.__frostboundDebug.getCategoryBreakdown ? window.__frostboundDebug.getCategoryBreakdown() : {};"
        )
        high_mesh_dump = driver.execute_script(
            "return window.__frostboundDebug.getVisibleMeshList ? window.__frostboundDebug.getVisibleMeshList() : [];"
        )
        high_png_path = evidence_dir / f"{prefix}_high_390x844.png"
        driver.save_screenshot(str(high_png_path))
        shutil.copy2(high_png_path, brain_evidence_dir / f"{prefix}_high_390x844.png")

        # 2. Toggle to Low Quality
        quality_btn.click()
        time.sleep(1.5)
        low_state = driver.execute_script("return window.__frostboundDebug.getState();")
        low_breakdown = driver.execute_script(
            "return window.__frostboundDebug.getCategoryBreakdown ? window.__frostboundDebug.getCategoryBreakdown() : {};"
        )
        mesh_dump = driver.execute_script(
            "return window.__frostboundDebug.getVisibleMeshList ? window.__frostboundDebug.getVisibleMeshList() : [];"
        )
        low_png_path = evidence_dir / f"{prefix}_low_390x844.png"
        driver.save_screenshot(str(low_png_path))
        shutil.copy2(low_png_path, brain_evidence_dir / f"{prefix}_low_390x844.png")

        logs = driver.get_log("browser")
        severe_logs = [log for log in logs if log["level"] == "SEVERE" and "favicon" not in log["message"]]

        report = {
            "high_quality": {
                "quality": high_state.get("quality"),
                "rendererCalls": high_state.get("rendererCalls"),
                "targetBudget": f"<= {high_budget}",
                "status": "PASS" if (high_state.get("rendererCalls") or 0) <= high_budget else "FAIL",
                "categories": high_breakdown,
            },
            "low_quality": {
                "quality": low_state.get("quality"),
                "rendererCalls": low_state.get("rendererCalls"),
                "targetBudget": f"<= {low_budget}",
                "status": "PASS" if (low_state.get("rendererCalls") or 0) <= low_budget else "FAIL",
                "categories": low_breakdown,
            },
            "severe_console_errors": len(severe_logs),
        }

        print("\n=== DRAW CALL BUDGET AUDIT REPORT ===")
        print(json.dumps(report, indent=2))
        print("\n=== HIGH QUALITY MESH SUMMARY ===")
        parent_counts = {}
        for m in high_mesh_dump:
            key = f"{m.get('parent')}:{m.get('name')}"
            parent_counts[key] = parent_counts.get(key, 0) + 1
        print(json.dumps(parent_counts, indent=2))
        return report
    finally:
        driver.quit()
        httpd.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", default="audit")
    parser.add_argument("--high", type=int, default=130)
    parser.add_argument("--low", type=int, default=85)
    args = parser.parse_args()
    run_audit(args.prefix, args.high, args.low)
