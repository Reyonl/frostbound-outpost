"""Capture screenshot and verify state/rendering across viewports using Selenium."""

import argparse
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


def capture(name: str, width: int = 390, height: int = 844, dpr: float = 2.0, wait_sec: float = 2.5) -> dict:
    dist_dir = Path(__file__).resolve().parents[2] / "web_game" / "dist"
    evidence_dir = Path(__file__).resolve().parents[2] / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    out_path = evidence_dir / f"{name}.png"

    handler = functools.partial(QuietHandler, directory=str(dist_dir))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument(f"--window-size={width + 20},{height + 40}")
    opts.add_argument("--disable-gpu-sandbox")
    opts.add_argument("--use-gl=angle")
    opts.add_argument("--use-angle=swiftshader")
    opts.add_argument("--enable-webgl")
    opts.add_argument("--ignore-gpu-blocklist")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option(
        "mobileEmulation",
        {
            "deviceMetrics": {"width": width, "height": height, "pixelRatio": dpr},
            "userAgent": (
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
            ),
        },
    )
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})

    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(f"http://127.0.0.1:{port}/?debug=1")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='resource-hud']"))
        )
        time.sleep(wait_sec)
        driver.save_screenshot(str(out_path))

        state = driver.execute_script("return window.__frostboundDebug ? window.__frostboundDebug.getState() : {};")

        # Check console logs for errors
        logs = driver.get_log("browser")
        severe_logs = [log for log in logs if log["level"] == "SEVERE" and "favicon" not in log["message"]]

        result = {
            "name": name,
            "width": width,
            "height": height,
            "dpr": dpr,
            "screenshot": str(out_path),
            "state": state,
            "severe_logs": severe_logs,
        }
        print(f"Captured: {out_path} ({width}x{height} @ {dpr}x)")
        print(f"  Quality: {state.get('quality')}, Renderer Calls: {state.get('rendererCalls')}")
        print(f"  Console SEVERE errors: {len(severe_logs)}")
        return result
    finally:
        driver.quit()
        httpd.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="g1_after_390x844")
    parser.add_argument("--width", type=int, default=390)
    parser.add_argument("--height", type=int, default=844)
    args = parser.parse_args()
    res = capture(args.name, args.width, args.height)
    print(json.dumps(res, indent=2))
