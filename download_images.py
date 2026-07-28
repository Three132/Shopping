#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ดาวน์โหลดรูปชิ้นส่วนทั้งหมดของ ClickRobot Shopping มาเก็บไว้ในเครื่อง (โฟลเดอร์ images/)
รันสคริปต์นี้ในเครื่อง/สภาพแวดล้อมที่ต่ออินเทอร์เน็ตได้ปกติ (เช่นใน Antigravity)

วิธีใช้:
    pip install requests
    python download_images.py

ลองไล่ดาวน์โหลดทีละแหล่งต่อ 1 ชิ้นส่วน เรียงตามความน่าเชื่อถือ:
    1) VEX Robotics official CDN (เฉพาะหมวด VEX IQ)
    2) LEGO CDN ทางการ (ตรงที่สุด อิงจาก element ID)
    3) Brickset
    4) BrickLink (อิงจากรหัส design — รวมเบอร์ยางสำหรับชุดล้อ+ยาง EV3)
ชิ้นไหนดาวน์โหลดสำเร็จจะข้ามไม่โหลดซ้ำถ้ารันสคริปต์อีกรอบ
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

CATALOG_FILE = "catalog.json"
OUTPUT_DIR = "images"
TIMEOUT = 12
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

# รหัสสี BrickLink จริง (จาก v2.bricklink.com/catalog/color-guide) — ใช้แทน 0 (Not Applicable)
# เพราะโค้ด 0 แทบไม่มีรูปจริงสำหรับชิ้นส่วนสีปกติ ต้องระบุสีให้ตรงถึงจะได้รูป
BL_COLOR_ID = {
    "Black": 11, "White": 1, "Grey": 86, "Dark Grey": 85, "Light Grey": 86,
    "Blue": 7, "Red": 5, "Yellow": 3, "Green": 36, "Tan": 2, "Sand Yellow": 69,
    "Yellowish Green": 34, "Medium Azur": 156, "Orange": 4,
    "Trans-Clear": 12, "Trans-Green": 20, "Trans-Light Blue": 15,
    "Trans-Red": 17, "Trans-Yellow": 19,
}


def bl_color_id(color):
    return BL_COLOR_ID.get(color, 0)


def sources_for(part):
    """คืนลิสต์ URL ที่จะลองดาวน์โหลด เรียงจากน่าเชื่อถือที่สุดก่อน"""
    sources = []
    element_id = part.get("elementId") or ""
    num = part.get("num") or ""
    img = part.get("img") or ""
    tire_num = part.get("tireNum") or ""
    if img:
        sources.append((
            "https://content.vexrobotics.com/resources/parts-posters/iqgen2/education-kit/%s.svg" % img,
            ".svg",
        ))
    if element_id:
        sources.append((
            "https://www.lego.com/cdn/product-assets/element.img.lod5photo.192x192/%s.jpg" % element_id,
            ".jpg",
        ))
        sources.append((
            "https://images.brickset.com/parts/%s.jpg" % element_id,
            ".jpg",
        ))
    if num and not img:
        cid = bl_color_id(part.get("color") or "")
        sources.append((
            "https://img.bricklink.com/ItemImage/PN/%d/%s.png" % (cid, num),
            ".png",
        ))
        if cid != 0:
            sources.append((
                "https://img.bricklink.com/ItemImage/PN/0/%s.png" % num,
                ".png",
            ))
    if tire_num:
        cid = bl_color_id(part.get("color") or "")
        sources.append((
            "https://img.bricklink.com/ItemImage/PN/%d/%s.png" % (cid, tire_num),
            ".png",
        ))
    return sources


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = resp.read()
        content_type = resp.headers.get("Content-Type", "")
        return data, content_type


def download_one(part):
    pid = part["id"]
    for url, ext in sources_for(part):
        out_path = os.path.join(OUTPUT_DIR, pid + ext)
        try:
            data, content_type = fetch(url)
            if len(data) < 300 or "image" not in content_type:
                continue
            with open(out_path, "wb") as f:
                f.write(data)
            return out_path, url
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ConnectionError):
            continue
        except Exception:
            continue
    return None, None


def already_downloaded(pid):
    for ext in (".jpg", ".png", ".svg"):
        p = os.path.join(OUTPUT_DIR, pid + ext)
        if os.path.exists(p) and os.path.getsize(p) > 300:
            return p
    return None


def main():
    if not os.path.exists(CATALOG_FILE):
        print("ไม่พบไฟล์ %s ต้องอยู่โฟลเดอร์เดียวกับสคริปต์นี้" % CATALOG_FILE)
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(CATALOG_FILE, encoding="utf-8") as f:
        catalog = json.load(f)

    all_parts = []
    for items in catalog.values():
        all_parts.extend(items)

    print("ทั้งหมด %d ชิ้นส่วน กำลังดาวน์โหลด...\n" % len(all_parts))

    ok = 0
    skipped = 0
    failed = []

    for i, part in enumerate(all_parts, 1):
        pid = part["id"]
        existing = already_downloaded(pid)
        if existing:
            skipped += 1
            print("[%d/%d] มีอยู่แล้ว  %-30s %s" % (i, len(all_parts), pid, existing))
            continue

        path, src = download_one(part)
        if path:
            ok += 1
            print("[%d/%d] สำเร็จ      %-30s <- %s" % (i, len(all_parts), pid, src))
        else:
            failed.append(pid)
            print("[%d/%d] ไม่สำเร็จ   %-30s (ลองครบทุกแหล่งแล้ว)" % (i, len(all_parts), pid))

        time.sleep(0.12)  # กันโดน rate-limit จากเซิร์ฟเวอร์ปลายทาง

    print("\n==============================")
    print("ดาวน์โหลดใหม่สำเร็จ : %d" % ok)
    print("มีอยู่แล้ว (ข้าม)    : %d" % skipped)
    print("ไม่สำเร็จ           : %d" % len(failed))
    if failed:
        print("\nรายการที่ไม่สำเร็จ (จะไปโชว์ชื่อชิ้นส่วนแทนรูปในเว็บ):")
        for pid in failed:
            print("  - " + pid)
    print("\nเปิด clickrobot-shopping.html ได้เลย จะใช้รูปจากโฟลเดอร์ images/ นี้โดยอัตโนมัติ")


if __name__ == "__main__":
    main()
