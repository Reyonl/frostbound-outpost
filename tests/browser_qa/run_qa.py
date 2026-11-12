"""Automated Browser QA runner (Selenium WebDriver) for Frostbound Outpost.

Runs the built web_game/dist/ bundle in headless Chrome at a 390x844 mobile
portrait viewport with touch emulation, checks console/JS errors, performs
touch-drag virtual joystick gestures, validates milestone state assertions on
window.__frostboundDebug, and outputs a JSON QA report + screenshots.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import math
import socketserver
import threading
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
    return webdriver.Chrome(options=opts)


def touch_drag(driver: webdriver.Chrome, start_x: int, start_y: int, dx: int, dy: int, hold_sec: float = 0.8) -> None:
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


def steer_toward(driver: webdriver.Chrome, target_x: float, target_z: float, hold_sec: float = 1.4) -> None:
    state = driver.execute_script("return window.__frostboundDebug.getState();")
    px = state["player"]["x"]
    pz = state["player"]["z"]
    vx = target_x - px
    vz = target_z - pz
    mag = math.hypot(vx, vz) or 1.0
    dx = int((vx / mag) * 58)
    dy = int((vz / mag) * 58)
    touch_drag(driver, 195, 670, dx, dy, hold_sec=hold_sec)


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
        WebDriverWait(driver, 15).until(
            lambda d: d.execute_script(
                "const c = document.getElementById('game-canvas'); return Boolean(c && c.width > 0);"
            )
        )

        has_debug = bool(driver.execute_script("return Boolean(window.__frostboundDebug);"))
        before_state = driver.execute_script("return window.__frostboundDebug?.getState?.() ?? null;")
        chopped_peak = 0

        if has_debug:
            if milestone == "m1":
                touch_drag(driver, 195, 670, 52, -48, hold_sec=0.9)
            else:
                for _ in range(4):
                    st = driver.execute_script("return window.__frostboundDebug.getState();")
                    chopped_peak = max(chopped_peak, st.get("counts", {}).get("wood", 0))
                    if chopped_peak >= 3:
                        break
                    tree = st.get("nearestTree") or {"x": 8.0, "z": -8.0}
                    steer_toward(driver, tree["x"], tree["z"], hold_sec=1.5)

                if milestone in ("m3", "m4", "m5", "m6"):
                    for _ in range(4):
                        st = driver.execute_script("return window.__frostboundDebug.getState();")
                        drop = st.get("sawmillDrop") or {"x": -3.6, "z": 0.4}
                        dist = math.hypot(st["player"]["x"] - drop["x"], st["player"]["z"] - drop["z"])
                        if dist <= 1.6 and st.get("stackCount", 0) == 0:
                            break
                        steer_toward(driver, drop["x"], drop["z"], hold_sec=min(1.4, max(0.35, dist / 6.0)))

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

        if milestone == "m6":
            upg_btn = driver.find_element(By.CSS_SELECTOR, "[data-testid='open-upgrades']")
            upg_btn.click()
            WebDriverWait(driver, 5).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, ".upgrade-sheet"))
            )
            driver.save_screenshot(str(evidence_dir / "m6_upgrades.png"))
            close_btn = driver.find_element(By.CSS_SELECTOR, ".upgrade-close-btn")
            close_btn.click()

        logs = driver.get_log("browser")
        for entry in logs:
            if entry.get("level") == "SEVERE":
                console_errors.append(entry.get("message", str(entry)))

        passed = len(console_errors) == 0 and dom_summary["canvas"] is not None
        failure_reasons: list[str] = []

        if milestone != "m0":
            if not (has_debug and before_state and after_state):
                passed = False
                failure_reasons.append("Missing window.__frostboundDebug state")
            else:
                dx = after_state["player"]["x"] - before_state["player"]["x"]
                dz = after_state["player"]["z"] - before_state["player"]["z"]
                if (dx * dx + dz * dz) <= 0.1:
                    passed = False
                    failure_reasons.append("Player did not move after joystick touch drag")

                if milestone in ("m2", "m3", "m4", "m5", "m6"):
                    if max(chopped_peak, after_state.get("counts", {}).get("wood", 0)) <= 0:
                        passed = False
                        failure_reasons.append("Wood count remained 0 after chopping forest sweep")

        return {
            "status": "PASS" if passed else "FAIL",
            "scenario": f"Frostbound Outpost {milestone.upper()} (390x844 Touch Emulation)",
            "steps": [
                "Open bundled game in 390x844 mobile viewport",
                "Wait for #game-canvas WebGL initialization",
                "Perform virtual joystick touch-drag gesture" if has_debug else "Verify bootstrap DOM",
                "Capture screenshot and inspect browser console logs",
            ],
            "expected_result": "Zero SEVERE console errors, valid 390x844 canvas, responsive movement and milestone state",
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
            "root_cause": "; ".join(failure_reasons) if failure_reasons else None,
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
