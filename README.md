# Bedrock Character Studio

เว็บสร้างโครง Add-on ตัวละครสำหรับ Minecraft Bedrock แบบเริ่มต้น ใช้งานได้จากเบราว์เซอร์และรองรับมือถือ

## ความสามารถปัจจุบัน

- อัปโหลดและดูตัวอย่างสกิน PNG
- ตั้งชื่อโปรเจกต์และตัวละคร
- เลือกสีผม สีตา และสีผิว
- เลือกสีหน้า: ปกติ / มีความสุข / โกรธ / เศร้า
- กำหนดค่าการขยับผมแบบจำลองด้วย Animation
- เลือกไอเทม 1 ชิ้นสำหรับเปิดเมนูในเกม
- ดาวน์โหลด Config JSON
- สร้างโครง Behavior Pack + Resource Pack เป็นไฟล์ `.mcaddon`

## เปิดเว็บด้วย GitHub Pages

1. เข้า `Settings` ของ Repository
2. เลือก `Pages`
3. ในหัวข้อ `Build and deployment` เลือก `Deploy from a branch`
4. เลือก Branch `main` และ Folder `/(root)`
5. กด `Save`

หลัง GitHub สร้างหน้าเว็บแล้ว เว็บไซต์จะอยู่ที่:

`https://ismyp12-wq.github.io/BedrockCharacterStudio/`

## ข้อจำกัดของรุ่นเริ่มต้น

ไฟล์ที่เว็บสร้างจะมีระบบ Script เปิดเมนูและเปลี่ยนแท็กสีหน้า แต่ยังต้องนำ Geometry, Texture, Animation Controller และ Render Controller ของตัวละครมาเชื่อมกับแท็กต่อเอง จึงจะแสดงการเปลี่ยนหน้าและผมขยับจริงในเกม

## เทคโนโลยี

- HTML / CSS / JavaScript
- JSZip สำหรับสร้างไฟล์ `.mcaddon` ในเบราว์เซอร์
- Minecraft Bedrock Script API
