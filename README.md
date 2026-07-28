# ClickRobot Shopping — วิธีใช้ไฟล์ชุดนี้

## ไฟล์ในชุดนี้
- `clickrobot-shopping.html` — ตัวเว็บช้อปปิ้ง (เปิดตรง ๆ ในเบราว์เซอร์ได้เลย)
- `ClickRobot-Shopping-Backend.gs` — สคริปต์ฝั่ง Google Sheets (ดูวิธี deploy ด้านล่าง)
- `download_images.py` — สคริปต์โหลดรูปชิ้นส่วนทั้ง 325 ชิ้นมาเก็บไว้ในเครื่อง (EV3 119 / WeDo 115 / VEX IQ 91)
- `catalog.json` — ข้อมูลชิ้นส่วนทั้งหมด (ให้ download_images.py อ่าน)

## ขั้นตอนที่ 1 — โหลดรูปมาเก็บในเครื่อง (แก้ปัญหารูปไม่ขึ้น)
เปิด terminal ในโฟลเดอร์นี้ แล้วรัน:

```
pip3 install requests
python3 download_images.py
```

(บน Mac/Linux เรียก `python3`/`pip3` ไม่ใช่ `python`/`pip` เฉย ๆ — ถ้าเครื่องไหนมี `python`/`pip` อยู่แล้วก็ใช้ได้เหมือนกัน)


สคริปต์จะไล่โหลดรูปทีละชิ้น จากหลายแหล่งเรียงตามลำดับ (LEGO → Brickset → BrickLink)
เก็บไว้ในโฟลเดอร์ `images/` ที่มันสร้างขึ้นเอง ชิ้นไหนดาวน์โหลดสำเร็จแล้วรันซ้ำจะข้ามให้อัตโนมัติ
ชิ้นไหนหาไม่เจอจริง ๆ หน้าเว็บจะโชว์ชื่อชิ้นส่วนแทนรูป (ไม่ค้าง ไม่พัง)

ไฟล์ `clickrobot-shopping.html` ตั้งไว้ให้ใช้รูปจากโฟลเดอร์ `images/` นี้เป็นอันดับแรกอยู่แล้ว
ไม่ต้องแก้อะไรเพิ่ม แค่ให้โฟลเดอร์ `images/` อยู่ข้าง ๆ ไฟล์ html เสมอ

## ขั้นตอนที่ 2 — ตั้งค่า Google Sheets backend (ถ้ายังไม่ได้ทำ)
1. สร้าง Google Sheet ใหม่ (ว่างเปล่า)
2. ส่วนขยาย → Apps Script → ลบโค้ดเดิม แล้ววางเนื้อหาไฟล์ `ClickRobot-Shopping-Backend.gs` ทั้งหมด
3. Deploy → New deployment → ประเภท "Web app" → Execute as: Me, Who has access: Anyone
4. คัดลอก Web app URL ที่ได้
5. เปิด `clickrobot-shopping.html` ด้วยโปรแกรมแก้ไขข้อความ หาบรรทัด
   `const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";`
   แล้วแทนด้วย URL ที่คัดลอกมา

## ขั้นตอนที่ 3 — ใช้งาน
เปิด `clickrobot-shopping.html` ในเบราว์เซอร์ปกติได้เลย (ไม่ใช่หน้าพรีวิวในแอป Claude)
ทดสอบสั่งซื้อ 1 รายการ ระบบจะสร้างชีท Orders/Totals ในกูเกิลชีทให้เองอัตโนมัติ

## แก้ข้อมูลชิ้นส่วน
รายการชิ้นส่วนอยู่ในอาเรย์ `CATALOG` ต้นไฟล์ `clickrobot-shopping.html` (ในแท็ก `<script>`)
แต่ละชิ้นมี `id`, `name`, `num` (รหัส LEGO), `elementId` (ใช้ต่อ URL รูป), `color`
ถ้าเพิ่ม/แก้ชิ้นส่วนใหม่ ให้แก้ทั้งใน `CATALOG` ของ html และใน `catalog.json` ให้ตรงกัน
แล้วรัน `download_images.py` อีกรอบเพื่อโหลดรูปของชิ้นที่เพิ่มมาใหม่
