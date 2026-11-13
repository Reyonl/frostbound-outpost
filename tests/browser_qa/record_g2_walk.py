"""Capture G2 After screenshot and generate an animated GIF of player walking."""

import functools
import http.server
import io
import shutil
import socketserver
import threading
import time
from pathlib import Path
from PIL import Image
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def run_capture_and_record():
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
    try:
        driver.get(f"http://127.0.0.1:{port}/?debug=1")
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#game-canvas"))
        )
        time.sleep(2.0)

        # 1. Capture still after screenshot at 390x844
        after_img_path = evidence_dir / "g2_after_390x844.png"
        driver.save_screenshot(str(after_img_path))
        shutil.copy2(after_img_path, brain_evidence_dir / "g2_after_390x844.png")
        print(f"Captured {after_img_path}")

        # Also copy g2_before to brain evidence if not already there
        before_src = evidence_dir / "g2_before_390x844.png"
        if before_src.exists():
            shutil.copy2(before_src, brain_evidence_dir / "g2_before_390x844.png")

        # 2. Record walking sequence
        frames = []
        # Start walking forward ('w')
        driver.execute_script("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));")
        time.sleep(0.1)

        # Capture walking frames over 1.8 seconds (approx 18 frames)
        for i in range(16):
            png_bytes = driver.get_screenshot_as_png()
            img = Image.open(io.BytesIO(png_bytes))
            frames.append(img.convert("RGB"))
            time.sleep(0.08)

        # Add some diagonal movement to show lateral lean/banking
        driver.execute_script("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));")
        for i in range(8):
            png_bytes = driver.get_screenshot_as_png()
            img = Image.open(io.BytesIO(png_bytes))
            frames.append(img.convert("RGB"))
            time.sleep(0.08)

        # Release keys to show squash on stop
        driver.execute_script("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));")
        driver.execute_script("window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));")
        for i in range(6):
            png_bytes = driver.get_screenshot_as_png()
            img = Image.open(io.BytesIO(png_bytes))
            frames.append(img.convert("RGB"))
            time.sleep(0.08)

        # 3. Assemble and save animated GIF
        gif_path = evidence_dir / "g2_player_walk.gif"
        if frames:
            # Optimize size: resize to half resolution (390x844) to keep GIF size reasonable (~1-2MB)
            processed_frames = []
            for f in frames:
                # Pillow resize with Lanczos
                resized = f.resize((390, 844), Image.Resampling.LANCZOS)
                # Convert to palette mode with adaptive palette for crisp GIF rendering
                quantized = resized.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
                processed_frames.append(quantized)

            processed_frames[0].save(
                str(gif_path),
                save_all=True,
                append_images=processed_frames[1:],
                duration=90,  # 90ms per frame (~11 fps)
                loop=0,
                optimize=True,
            )
            shutil.copy2(gif_path, brain_evidence_dir / "g2_player_walk.gif")
            print(f"Generated animated walk GIF: {gif_path} ({len(frames)} frames)")

        # Verify no console errors
        logs = driver.get_log("browser")
        severe_logs = [log for log in logs if log["level"] == "SEVERE" and "favicon" not in log["message"]]
        print(f"Console severe errors: {len(severe_logs)}")
        if severe_logs:
            for l in severe_logs:
                print(f"  {l['message']}")

    finally:
        driver.quit()
        httpd.shutdown()


if __name__ == "__main__":
    run_capture_and_record()
