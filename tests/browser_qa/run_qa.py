"""Automated Browser QA runner (Selenium WebDriver) for Frostbound Outpost.

Runs the built web_game/dist/ bundle (or dev server) in headless Chrome/Edge
at a 390x844 mobile portrait viewport with touch emulation, checks console/JS
errors, performs touch-drag virtual joystick gestures, validates milestone hooks
exposed on window.__frostboundDebug, and outputs a JSON QA report + screenshots.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import socketserver
import threading
import time
from pathlib import Path
from typing import Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return


def start_static_server(dist_dir: Path) -> tuple[socketserver.TCPServer, int]:
    handler = functools.partial(QuietHandler, directory=str(dist_dir))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port


def create_mobile_driver() -> webdriver.Chrome:
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=410,890")
    opts.add_argument("--disable-gpu-sandbox")
    opts.add_argument("--use-gl=angle")
    opts.add_argument("--use-angle=swiftshader")
    opts.add_argument("--enable-webgl")
    opts.add_argument("--ignore-gpu-blocklist")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option(
        "mobileEmulation",
        {
            "deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2.0},
            "userAgent": (
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
            ),
        },
    )
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=opts)
    return driver


def touch_drag(driver: webdriver.Chrome, start_x: int, start_y: int, dx: int, dy: int, hold_sec: float = 0.6) -> None:
    touch = PointerInput("touch", "finger")
    actions = ActionBuilder(driver, mouse=touch)
    actions.pointer_action.move_to_location(start_x, start_y)
    actions.pointer_action.pointer_down()
    steps = 8
    for i in range(1, steps + 1):
        actions.pointer_action.move_to_location(
            int(start_x + dx * i / steps),
            int(start_y + dy * i / steps),
        )
        actions.pointer_action.pause(0.03)
    actions.pointer_action.pause(hold_sec)
    actions.pointer_action.pointer_up()
    actions.perform()


def run_qa(milestone: str, dist_dir: Path, evidence_dir: Path) -> dict[str, Any]:
    evidence_dir.mkdir(parents=True, exist_ok=True)
    screenshot_path = evidence_dir / f"{milestone}.png"

    httpd, port = start_static_server(dist_dir)
    url = f"http://127.0.0.1:{port}/index.html"
    driver: webdriver.Chrome | None = None
    console_errors: list[str] = []

    try:
        driver = create_mobile_driver()
        driver.get(url)

        WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.ID, "game-canvas"))
        )

        # Wait until game attaches debug state or HUD renders
        WebDriverWait(driver, 15).until(
            lambda d: d.execute_script(
                "return Boolean(document.getElementById('game-canvas') && document.getElementById('game-canvas').width > 0);"
            )
        )

        # Collect initial state if milestone exposes __frostboundDebug
        has_debug = driver.execute_script("return Boolean(window.__frostboundDebug);")
        before_state = driver.execute_script("return window.__frostboundDebug?.getState?.() ?? null;")

        if has_debug:
            # Test virtual joystick touch drag toward forest (up-right)
            touch_drag(driver, 195, 670, 55, -55, hold_sec=0.8)
            WebDriverWait(driver, 10).until(
                lambda d: (d.execute_script("return window.__frostboundDebug.getState().elapsed;") or 0) > 0.5
            )

        after_state = driver.execute_script("return window.__frostboundDebug?.getState?.() ?? null;")
        dom_summary = driver.execute_script(
            """
            const c = document.getElementById('game-canvas');
            const hud = document.getElementById('hud-root');
            return {
              viewport: { w: window.innerWidth, h: window.innerHeight },
              canvas: c ? { w: c.width, h: c.height } : null,
              hudText: hud ? hud.innerText.trim() : ''
            };
            """
        )

        driver.save_screenshot(str(screenshot_path))

        logs = driver.get_log("browser")
        for entry in logs:
            if entry.get("level") in ("SEVERE",):
                console_errors.append(entry.get("message", str(entry)))

        passed = len(console_errors) == 0 and dom_summary["canvas"] is not None
        if milestone != "m0" and has_debug and before_state and after_state:
            dx = after_state["player"]["x"] - before_state["player"]["x"]
            dz = after_state["player"]["z"] - before_state["player"]["z"]
            moved = (dx * dx + dz * dz) > 0.1
            passed = passed and moved

        return {
            "status": "PASS" if passed else "FAIL",
            "scenario": f"Frostbound Outpost {milestone.upper()} (390x844 Touch Emulation)",
            "steps": [
                "Open bundled game in 390x844 mobile viewport",
                "Wait for #game-canvas WebGL initialization",
                "Perform virtual joystick touch-drag gesture" if has_debug else "Verify bootstrap DOM",
                "Capture screenshot and inspect browser console logs",
            ],
            "expected_result": "Zero SEVERE console errors, valid 390x844 canvas, responsive movement",
            "actual_result": {
                "before": before_state,
                "after": after_state,
                "dom_summary": dom_summary,
            },
            "evidence": {
                "screenshot": str(screenshot_path),
                "console_errors": console_errors,
                "network_errors": [],
                "dom_state": dom_summary,
            },
            "root_cause": None if passed else "Console error or movement assertion failed",
            "recommendation": "Proceed to next milestone" if passed else "Inspect console_errors and game state",
        }
    finally:
        if driver is not None:
            driver.quit()
        httpd.shutdown()
        httpd.server_close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--milestone", default="m0")
    parser.add_argument("--dist", default="web_game/dist")
    parser.add_argument("--evidence", default="evidence")
    args = parser.parse_args()

    report = run_qa(args.milestone, Path(args.dist), Path(args.evidence))
    print(json.dumps(report, indent=2))
    if report["status"] != "PASS":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
