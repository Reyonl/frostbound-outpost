"""Verify G4 HUD polish, capture screenshots at multiple viewports, test 5-tap gesture and upgrade modal."""

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

# Remove outdated npm path to use matching ChromeDriver
os.environ["PATH"] = ";".join(
    p for p in os.environ.get("PATH", "").split(";") if "npm" not in p.lower()
)

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

root_dir = Path(__file__).resolve().parents[2]
dist_dir = root_dir / "web_game" / "dist"
evidence_dir = root_dir / "evidence"
evidence_dir.mkdir(parents=True, exist_ok=True)
brain_evidence_dir = Path(r"C:\Users\ThinkPad\.gemini\antigravity\brain\7baa4ddd-5634-4f6b-bae9-38cf9b6617b1\evidence")
brain_evidence_dir.mkdir(parents=True, exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


handler = functools.partial(QuietHandler, directory=str(dist_dir))
httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
port = httpd.server_address[1]
t = threading.Thread(target=httpd.serve_forever, daemon=True)
t.start()

viewports = [
    ("g4_after_390x844", 390, 844),
    ("g4_after_360x800", 360, 800),
    ("g4_after_412x915", 412, 915),
]

for name, w, h in viewports:
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument(f"--window-size={w+20},{h+40}")
    opts.add_argument("--disable-gpu-sandbox")
    opts.add_argument("--use-gl=angle")
    opts.add_argument("--use-angle=swiftshader")
    opts.add_argument("--enable-webgl")
    opts.add_argument("--no-sandbox")
    opts.add_experimental_option(
        "mobileEmulation",
        {"deviceMetrics": {"width": w, "height": h, "pixelRatio": 2.0}, "userAgent": "Mozilla/5.0 Pixel 7"},
    )
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=opts)
    try:
        driver.get(f"http://127.0.0.1:{port}/?debug=1")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='resource-hud']"))
        )
        time.sleep(2.5)
        out_path = evidence_dir / f"{name}.png"
        driver.save_screenshot(str(out_path))
        shutil.copy2(out_path, brain_evidence_dir / f"{name}.png")
        print(f"Captured {name} at {w}x{h}")
    finally:
        driver.quit()

print("Capturing 5-tap gesture & Upgrade modal evidence...")
opts = ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--window-size=410,884")
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
    # Test WITHOUT ?debug=1 to verify 5-tap gesture unlocks debug HUD
    driver.get(f"http://127.0.0.1:{port}/")
    quality_btn = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, ".hud-quality-btn"))
    )
    time.sleep(1.0)
    debug_hud = driver.find_element(By.CSS_SELECTOR, ".debug-hud")
    initial_hidden = "hidden" in debug_hud.get_attribute("class")
    print(f"Debug HUD initially hidden without ?debug=1: {initial_hidden}")

    # Perform 5 rapid taps on quality button
    for i in range(1, 6):
        quality_btn.click()
        time.sleep(0.08)
        print(f"Tap {i} class: {debug_hud.get_attribute('class')}")

    time.sleep(0.3)
    unlocked_hidden = "hidden" in debug_hud.get_attribute("class")
    print(f"Debug HUD hidden after 5 taps: {unlocked_hidden} (should be False = unlocked!)")

    # Capture 5-tap unlocked screenshot
    g4_debug_unlocked = evidence_dir / "g4_5tap_debug_unlocked.png"
    driver.save_screenshot(str(g4_debug_unlocked))
    shutil.copy2(g4_debug_unlocked, brain_evidence_dir / "g4_5tap_debug_unlocked.png")
    print("Captured g4_5tap_debug_unlocked.png")

    # Now open Upgrades modal to verify tabs & styling
    upgrade_btn = driver.find_element(By.CSS_SELECTOR, "[data-testid='open-upgrades']")
    upgrade_btn.click()
    time.sleep(0.5)
    g4_upgrade_modal = evidence_dir / "g4_upgrade_modal.png"
    driver.save_screenshot(str(g4_upgrade_modal))
    shutil.copy2(g4_upgrade_modal, brain_evidence_dir / "g4_upgrade_modal.png")
    print("Captured g4_upgrade_modal.png")

    # Verify category filtering
    combat_tab = driver.find_element(By.CSS_SELECTOR, "[data-cat='combat']")
    combat_tab.click()
    time.sleep(0.3)
    rows = driver.find_elements(By.CSS_SELECTOR, ".upgrade-row")
    print(f"Combat tab filtered rows: {len(rows)} (expected 3: axeCount, axePower, spinSpeed)")

    # Check console logs
    logs = driver.get_log("browser")
    severe = [l for l in logs if l["level"] == "SEVERE" and "favicon" not in l["message"]]
    print(f"Severe console logs: {len(severe)}")
finally:
    driver.quit()
    httpd.shutdown()
