"""Audit draw calls in High and Low quality, with per-category breakdown."""

import functools
import http.server
import json
import socketserver
import threading
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def run_audit():
    dist_dir = Path(__file__).resolve().parents[2] / "web_game" / "dist"
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
        high_breakdown = driver.execute_script("return window.__frostboundDebug.getCategoryBreakdown ? window.__frostboundDebug.getCategoryBreakdown() : {};")
        driver.save_screenshot("evidence/g1_optimized_high_390x844.png")

        # 2. Toggle to Low Quality
        quality_btn.click()
        time.sleep(1.5)
        low_state = driver.execute_script("return window.__frostboundDebug.getState();")
        low_breakdown = driver.execute_script("return window.__frostboundDebug.getCategoryBreakdown ? window.__frostboundDebug.getCategoryBreakdown() : {};")
        mesh_dump = driver.execute_script("return window.__frostboundDebug.getVisibleMeshList ? window.__frostboundDebug.getVisibleMeshList() : [];")
        driver.save_screenshot("evidence/g1_optimized_low_390x844.png")

        logs = driver.get_log("browser")
        severe_logs = [log for log in logs if log["level"] == "SEVERE" and "favicon" not in log["message"]]

        report = {
            "high_quality": {
                "quality": high_state.get("quality"),
                "rendererCalls": high_state.get("rendererCalls"),
                "targetBudget": "<= 100",
                "status": "PASS" if (high_state.get("rendererCalls") or 0) <= 100 else "FAIL",
                "categories": high_breakdown,
            },
            "low_quality": {
                "quality": low_state.get("quality"),
                "rendererCalls": low_state.get("rendererCalls"),
                "targetBudget": "<= 70",
                "status": "PASS" if (low_state.get("rendererCalls") or 0) <= 70 else "FAIL",
                "categories": low_breakdown,
            },
            "severe_console_errors": len(severe_logs),
        }

        print("\n=== DRAW CALL BUDGET AUDIT REPORT ===")
        print(json.dumps(report, indent=2))
        print("\n=== LOW QUALITY VISIBLE MESH DUMP ===")
        print(json.dumps(mesh_dump, indent=2))
        return report
    finally:
        driver.quit()
        httpd.shutdown()


if __name__ == "__main__":
    run_audit()
