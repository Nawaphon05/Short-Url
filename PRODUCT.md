# Short URL

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

ย่อ URL เพื่อแชร์ คัดลอก เปิดลิงก์ และดาวน์โหลด QR Code เป็นโปรเจกต์สำหรับนำเสนอผลงาน

## Capabilities and Constraints

- Vue + CSS, Node.js/Express JavaScript และ PostgreSQL คงเทคโนโลยีเดิม
- Branch Feature/login เพิ่ม Sign up, Login, Logout และประวัติส่วนตัว ลิงก์เก่ายังเปิดได้แต่ไม่มีเจ้าของ จำนวนคลิกรวมการเปิดซ้ำ
- รอบล็อกอินแก้ Frontend, Backend และมี SQL migration เพิ่ม users/sessions โดยไม่เพิ่ม dependency; ไม่เปลี่ยนฐานข้อมูล Render หรือ Deploy โดยอัตโนมัติ
- Deploy, Architecture Diagram และ Microservice ทำภายหลัง ไม่ Commit หรือ Push จนกว่าผู้ใช้สั่ง

## Brand Commitments

ภาษาไทยเป็นหลัก ใช้ Login/Sign up/Logout ในส่วนสมาชิก ธีมล่าสุดใช้สีจากโลโก้ SYNERRY ที่ผู้ใช้ส่งเป็นแนวทาง: แดง ดำชาร์โคล ขาว และเทาอ่อน โดยคงชื่อ Short URL หัวเว็บกระชับ เน้นช่อง URL และปุ่มสร้างลิงก์ เปิด QR เมื่อกด ไม่มี Hero ใหญ่ gradient หรือข้อความโฆษณา

## Accessibility & Inclusion

รองรับมือถือและคีย์บอร์ด มี label, focus ที่เห็นชัด สีอ่านง่าย สถานะโหลด สำเร็จ ข้อผิดพลาด และข้อมูลว่าง ป้องกันการส่งซ้ำ

## Open Decisions

ยังไม่ระบุกลุ่มผู้ใช้เฉพาะและ Hosting
