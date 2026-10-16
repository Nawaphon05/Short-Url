# Microservices — วิธีรันและ Deploy

Merge PR #7 เข้า `main` แล้ว Deploy commit `8644b34` บน Render วันที่ 16 ตุลาคม 2026 บริการหลัก https://short-url-4xil.onrender.com ใช้ `Redirect mode: remote service` และ Redirect service https://short-url-redirect.onrender.com ขึ้น `Redirect service ready` ตาม Logs จากผู้ใช้ ดู [ผลออนไลน์และข้อที่ยังรอยืนยัน](SUBMISSION.md#ผลออนไลน์หลัง-deploy-pr-7)

## ขอบเขต

สถานะล่าสุด: Merge โหมด browser handoff commit `7f09f71` และ Deploy ทั้งสองบริการแล้ว บริการหลักตั้ง REDIRECT_SERVICE_MODE=browser, Redirect ตั้ง PUBLIC_BASE_URL เป็นเว็บหลัก ผล curl ยืนยัน Location ไปโดเมน Redirect ผู้ใช้ยืนยันเปิดหลังพัก 15 นาทีได้ในรอบทดสอบนี้ ดู [ผลล่าสุด](SUBMISSION.md#ผลออนไลน์ล่าสุดในโหมด-browser)

- `server`: Vue build, สมาชิก, จัดการลิงก์ และ Gateway `/r/:code`
- `redirect-service`: ตรวจลิงก์หมดอายุ/ถูกลบ เพิ่ม clicks เฉพาะ GET และคืนสถานะ Redirect
- ฐานข้อมูล PostgreSQL ร่วมกัน ไม่มี migration ใหม่ในรอบนี้
- Gateway รักษา URL/QR เดิม ใช้ PUBLIC_BASE_URL เดิม ไม่เปลี่ยนเป็นโดเมนของ Redirect service
- ไม่มี REDIRECT_SERVICE_URL: ใช้ localRedirectRoutes เดิมเพื่อรองรับการทยอย Deploy/ย้อนกลับ โหมดนี้ไม่ใช่ Microservice

เป็นการแยกบริการ Redirect ออกจาก monolith โดยยังแชร์ schema และตาราง links บริการหลักเขียนข้อมูลลิงก์ ส่วน Redirect อ่านสถานะและเพิ่ม clicks จึงยังผูกกันด้านข้อมูล ไม่อ้างว่าแยกฐานข้อมูลอิสระสมบูรณ์

## ติดตั้งและรันในเครื่อง

ใช้โค้ด `main` หลัง PR #7 ใช้ Node ตาม `.node-version` และฐานข้อมูลในเครื่องที่สร้างตาราง links ตั้งค่า server/.env และรัน migration 001 → 002 → 003 ตาม [README](../README.md) แล้ว สำหรับ clone เก่าให้อัปเดต main และติดตั้ง dependencies ก่อน

```powershell
npm.cmd ci --prefix server
npm.cmd ci --prefix client
npm.cmd run build --prefix client
npm.cmd ci --prefix redirect-service
```

### วิธีเร็วสำหรับลองในเครื่อง

ถ้า server/.env เชื่อม PostgreSQL localhost อยู่แล้ว หลังติดตั้ง dependencies ทั้งสามส่วนและ Build ให้รันจากรากโปรเจกต์:

```powershell
npm.cmd run dev:services --prefix server
```

เปิด http://localhost:3062 บริการ Redirect ใช้พอร์ต 3063 ตัว launcher สุ่ม token ใน memory ให้ทั้งสอง process ไม่เขียน .env และไม่แสดง token กด Ctrl+C เพื่อหยุดทั้งคู่ ตั้ง LOCAL_WEB_PORT/LOCAL_REDIRECT_PORT ได้หากพอร์ตชน Launcher นี้ไม่ยอมใช้ฐานข้อมูลออนไลน์ กำหนดค่าฐานข้อมูลที่ตรวจแล้วให้ทั้งสองบริการโดยไม่ให้ .env ของ Redirect เปลี่ยนไปใช้ฐานข้อมูลอื่น และไม่รัน migration อัตโนมัติ

### ตั้งค่าแต่ละบริการด้วยตนเอง

สร้าง `redirect-service/.env` จาก `.env.example` เฉพาะเมื่อยังไม่มีไฟล์ ใส่ PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD ของฐานข้อมูลเดียวกับ server/.env ตั้ง PORT=3001 ห้ามใช้ฐานข้อมูลออนไลน์สำหรับทดสอบ

สร้าง token สุ่มด้วยคำสั่งนี้ เก็บผลเป็นความลับ ไม่ Commit หรือส่งภาพค่าจริง:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

ตั้ง `REDIRECT_SERVICE_TOKEN` ใน .env ของทั้งสองบริการให้เป็นค่าเดียวกัน ส่วน server/.env เพิ่ม:

```dotenv
REDIRECT_SERVICE_URL=http://localhost:3001
REDIRECT_SERVICE_TOKEN=replace-with-generated-random-token
REDIRECT_SERVICE_TIMEOUT_MS=70000
REDIRECT_SERVICE_MODE=browser
```

อย่าใช้ข้อความตัวอย่างเป็น token จริง ใน server/.env คง PORT และ PUBLIC_BASE_URL ของบริการหลัก เช่น 3000 และ http://localhost:3000

ใน redirect-service/.env ตั้ง PUBLIC_BASE_URL=http://localhost:3000 ให้กลับหน้าเว็บหลักได้ โหมด browser ใช้ public /r โดยไม่ส่ง token ไป Browser หากต้องการทดสอบ proxy ให้เปลี่ยน REDIRECT_SERVICE_MODE=proxy ส่วน local launcher dev:services ใช้โหมดจาก Environment ถ้าไม่ตั้งจะเป็น proxy; ทดสอบ browser แบบตั้งค่าทีละบริการตามส่วนนี้เพื่อให้พอร์ตและปุ่มกลับเว็บหลักตรงกัน

Terminal 1 จากรากโปรเจกต์:

```powershell
cd redirect-service
npm.cmd start
```

Terminal 2 จากรากโปรเจกต์:

```powershell
npm.cmd start --prefix server
```

ต้องเห็น `Redirect service ready` ที่บริการ Redirect และ `Redirect mode: remote service` ที่บริการหลัก จากนั้นเปิดโดเมน/พอร์ตของบริการหลัก รันสองบริการก่อนใช้งาน ปิดด้วย Ctrl+C และรีสตาร์ตหลังแก้ Backend/.env

## API ระหว่างบริการสำหรับโหมด proxy

`GET /internal/links/:code` และ `HEAD /internal/links/:code` ต้องมี `Authorization: Bearer <REDIRECT_SERVICE_TOKEN>` เสมอ ไม่ส่ง cookie ผู้ใช้หรือ Authorization ของ Browser ต่อไป

| ผล | ความหมาย |
|---|---|
| 302 + Location | ยังใช้งานได้ GET เพิ่มคลิกหนึ่งครั้ง HEAD ไม่เพิ่ม |
| 404 | ไม่พบหรือรหัสไม่ถูกแบบ |
| 410 + X-Link-State: expired/deleted | หมดอายุหรือถูกลบ ไม่เพิ่มคลิก |
| 401 | token ไม่ถูกต้อง |
| 503 | ฐานข้อมูลไม่พร้อม |

Gateway ไม่ตาม Location ของบริการปลายทางอัตโนมัติ จึงไม่ส่ง token ไปเว็บไซต์อื่น ตรวจ URL ปลายทางเป็น HTTP(S) ไม่รับ username/password กรณี 401, timeout, สถานะผิดแบบ หรือบริการไม่พร้อม จะแสดงหน้า 503 ธีมเดิมโดยไม่เผยความลับ

Timeout ค่าเริ่มต้น 70 วินาที รองรับ cold start บางกรณี กำหนดได้ 100–90000 ms ไม่มี automatic retry หรือ fallback ไป SQL เดิมเมื่อเปิด remote mode เพราะคำขอที่ timeout อาจเพิ่มคลิกสำเร็จไปแล้ว การนับเป็นจำนวนคำขอ GET ที่ประมวลผล ไม่ใช่จำนวนผู้ที่เห็นหน้าเว็บสำเร็จ และการลองใหม่ด้วยตนเองอาจเพิ่มอีกหนึ่งคลิก

โหมด proxy ที่ Deploy ในรอบก่อนเพิ่มการรอ `/healthz` ให้ได้ JSON `status=ok, service=redirect` ตรวจซ้ำห่างกัน 1 วินาทีภายใน timeout รวมก่อนเปิดลิงก์ ไม่ส่ง token/cookie ใน health probe และไม่ส่งคำขอเพิ่มคลิกซ้ำ การแก้ดังกล่าวถูก Merge/Deploy แล้ว แต่ยังพบ readiness timeout หลังพัก จึงเปลี่ยนออนไลน์ไปใช้ browser

การแก้ถัดมาที่ Merge/Deploy แล้วจำกัด health probe ครั้งละ 5 วินาทีรวม body เพิ่ม Logs attempts/elapsedMs/last โดยไม่บันทึก secrets แต่ผู้ใช้ยังพบ `attempts=67, elapsedMs=70001, last=http-502` จึงไม่ถือว่าการแก้ proxy ทำให้เปิดหลังพักผ่าน ปัจจุบันโค้ดนี้คงไว้สำหรับผู้เลือกใช้โหมด proxy เท่านั้น

`GET /healthz` ของ Redirect ตรวจการเชื่อม DB ตอบ status/service โดยไม่เผยข้อมูลบัญชี ส่วน `/api/health` เดิมเป็นสถานะบริการหลัก ไม่ได้ตรวจบริการ Redirect ทุกครั้ง

## Deploy แบบไม่เปลี่ยน URL เก่า

1. เก็บ commit/ค่าตั้งค่าเดิมและ Backup ฐานข้อมูลล่าสุด ไม่มี migration ใหม่ในรอบนี้
2. เตรียมโค้ดจาก Branch ที่ตรวจแล้ว บริการหลักยังไม่ตั้ง REDIRECT_SERVICE_URL จึงทำงานแบบเดิมได้
3. สร้าง Render **Web Service แยกแบบ Free** สำหรับ `redirect-service` เลือก Region เดียวกัน Root Directory=`redirect-service`, Build=`npm ci`, Start=`npm start`, Health Check Path=`/healthz` และ Node 22.21.0
4. ใส่ NODE_ENV=production, NODE_VERSION=22.21.0, DATABASE_URL ของฐานข้อมูลเดิม (Internal URL ใน Region เดียวกัน) และ REDIRECT_SERVICE_TOKEN ที่สุ่มไว้ในหน้า Environment ใช้ PORT ของ Render กำหนด [Node version](https://render.com/docs/node-version) ให้ตรงกับเครื่องทดสอบอย่างชัดเจน
5. รอ Redirect service Live และตรวจ healthz ก่อนเปิด remote mode
6. บริการหลัก: ตั้ง REDIRECT_SERVICE_URL เป็น HTTPS origin ของ Redirect service ไม่มี path/query ตั้ง token เดียวกัน และ timeout=70000 คง PUBLIC_BASE_URL โดเมนเดิมไว้ แล้ว Deploy โค้ดใหม่
7. ตรวจ Logs ว่า remote service และทดสอบทุกกรณีออนไลน์ตามด้านล่าง

Render Free รับ private-network inbound ไม่ได้ จึงใช้ HTTPS สาธารณะพร้อม service token สำหรับ Web Services ฟรีทั้งคู่ มีโควตาชั่วโมงรวม/idle spin-down/cold start และข้อจำกัด bandwidth/build ไม่ใช่ฟรีแบบไม่มีขีดจำกัด ดู [Render Free](https://render.com/docs/free) และตรวจ Billing ก่อนสร้าง ห้ามเลือก Private Service หรือแผนเสียเงินโดยไม่ตั้งใจ ห้ามใส่ token ใน client, README, screenshot, query string หรือ Git

หากใช้ database role แยกได้ แนะนำ Redirect มีเพียง SELECT คอลัมน์ที่ใช้และ UPDATE clicks เท่านั้น รอบนี้ไม่ได้เปลี่ยนสิทธิ์บัญชีฐานข้อมูลจริงให้โดยอัตโนมัติ

## ทางเลือก Browser handoff สำหรับการปลุกบริการ

โหมดจาก Branch `fix/browser-redirect-handoff` Merge เข้า main และ Deploy commit `7f09f71` แล้ว เปิดใช้งานออนไลน์ด้วย REDIRECT_SERVICE_MODE=browser เหตุผลคือ Browser เปิดปลุกบริการได้ตามหลักฐาน แต่คำขอ health จากบริการหลักเคยได้รับ 502 จนครบ 70 วินาที โหมดนี้เปลี่ยนเส้นทางการเปิด ไม่ได้อ้างว่าระบุสาเหตุภายใน Render ได้ทั้งหมด

- ตั้ง `REDIRECT_SERVICE_MODE=browser` ที่บริการหลัก หลัง Redirect service เวอร์ชันใหม่พร้อมแล้ว
- URL/QR ที่แชร์ยังเป็นโดเมนหลักเดิม บริการหลักตอบ 302 ไป `https://short-url-redirect.onrender.com/r/:code` โดยไม่เรียก health และไม่เพิ่มคลิก
- Browser เปิดบริการ Redirect โดยตรง ให้โฮสต์จัดการหน้า loading/spin-up จากนั้น Redirect ตรวจลิงก์และเพิ่ม clicks เฉพาะ GET ที่ใช้ได้หนึ่งครั้ง ก่อนตอบ 302 ไปเว็บไซต์ต้นฉบับ
- `/r/:code` บน Redirect เป็น public endpoint เช่นเดียวกับลิงก์สาธารณะเดิม ไม่ต้อง Login และไม่ใช้ service token ส่วน `/internal/links/:code` ยังตรวจ token และ API จัดการข้อมูลยังอยู่บริการหลัก
- ตั้ง `PUBLIC_BASE_URL=https://short-url-4xil.onrender.com` ที่ Redirect service ด้วย เพื่อให้ปุ่มกลับหน้าเว็บในหน้าสถานะพากลับบริการหลัก ไม่มีการส่ง token ใน URL หรือ Browser
- HEAD ที่โดเมนหลักตอบ 302 ไปบริการ Redirect โดยยังไม่รู้สถานะลิงก์ ต้องตาม Location ไปตรวจ HEAD ที่บริการ Redirect จึงได้สถานะสุดท้าย ไม่เพิ่ม clicks ทั้งสองทอด ลิงก์ไม่พบ/หมดอายุ/ถูกลบจะมี 404/410 ที่บริการ Redirect
- หากบริการ Redirect ล่มจริง Browser อาจเห็นหน้าผิดพลาดจากโฮสต์แทนหน้า 503 ของ Gateway; โหมดนี้ไม่สามารถรับประกันเวลาเริ่ม Free service หรือกำจัดปัญหาโฮสต์ทุกชนิดได้

### ลำดับ Deploy โหมดใหม่

1. Merge โค้ด แล้วตรวจว่า Redirect service Deploy commit ใหม่ที่มี public `/r/:code` แล้ว (Root Directory เดิมอาจทำให้ข้าม Auto Deploy ถ้าเปลี่ยนเฉพาะโฟลเดอร์อื่น ต้องดู commit จริง)
2. ใน Redirect service เพิ่ม PUBLIC_BASE_URL ของบริการหลักและ Deploy รอ Live; คง DATABASE_URL และ token เดิม ไม่สร้างฐานข้อมูลใหม่
3. ตรวจ `curl.exe -I https://short-url-redirect.onrender.com/r/UQO3RCbu` ของลิงก์ที่ใช้ได้ ต้องตอบ 302 ไปปลายทางและคลิกไม่เพิ่ม; ไม่มีการทดสอบนี้กับข้อมูลจริงในรอบพัฒนาโหมดใหม่
4. ในบริการหลักเพิ่ม REDIRECT_SERVICE_MODE=browser แล้ว Save/Deploy รอ Live; คง REDIRECT_SERVICE_URL/token/PUBLIC_BASE_URL เดิม
5. ทดสอบการเปิดและคลิก จากนั้นปล่อย idle และเปิดจาก URL เดิมโดยไม่เปิด health ล่วงหน้า ต้องรอหน้า Render แล้วไปปลายทางได้ จึงจะยืนยันข้อนี้ผ่าน พร้อมทดสอบ QR, HEAD สองทอด และหน้า 404/410 ซ้ำ
6. ย้อนกลับเป็น proxy ได้โดยตั้ง REDIRECT_SERVICE_MODE=proxy หรือเอาตัวแปรนี้ออกแล้ว Deploy; เอา REDIRECT_SERVICE_URL ออกทั้งหมดจะเป็น monolith ตามหัวข้อถัดไป

ผลในเครื่อง: ชุดทดสอบ 5/5 ผ่านทั้ง local/proxy/browser, การนับคลิกพร้อมกัน, HEAD/หมดอายุ/ลบ และ API สิทธิ์เจ้าของ พร้อม Browser Desktop/Mobile ตรวจหน้า 410 ที่บริการ Redirect และปุ่มกลับบริการหลักผ่าน ผลออนไลน์หลังเปิดโหมด: curl ยืนยันเส้นทาง handoff และผู้ใช้ยืนยันเปิดได้หลังพัก 15 นาที รายการ HEAD/QR/หน้าสถานะในโหมด browser ที่ยังไม่มีหลักฐานซ้ำระบุใน SUBMISSION ไม่ใช้ผล proxy ติ๊กแทน

## ย้อนกลับสู่ Monolith

เอา REDIRECT_SERVICE_URL ออกจาก Environment ของบริการหลักแล้ว Deploy ใหม่ เพื่อเลือก local rollback mode หรือ Deploy commit monolith เดิม PUBLIC_BASE_URL และ schema ไม่เปลี่ยน ไม่ต้อง Restore ทับหรือลบตาราง ปิดบริการ Redirect ได้หลังยืนยันว่าบริการหลักกลับมาทำงานแล้ว

## การตรวจรับ

ในเครื่อง: `npm.cmd test --prefix server` ต้องผ่านทั้ง local rollback และ two services พร้อม gateway timeout/failure tests โดยใช้ schema ชั่วคราวใน PostgreSQL localhost เท่านั้น และติดตั้ง dependencies ของ redirect-service ก่อน

ก่อนถือว่าขึ้น Microservice ออนไลน์แล้ว ต้องยืนยัน:

- ทั้งสองบริการ Deploy แยกกันและพร้อมใช้งาน
- เปิดลิงก์เก่าผ่านโดเมนเดิมและ QR มือถือได้
- GET เพิ่มหนึ่งคลิก HEAD ไม่เพิ่ม ไม่มีการ retry อัตโนมัติ
- ลิงก์หมดอายุ/ถูกลบตอบ 410 และคลิกไม่เพิ่ม ไม่พบตอบ 404
- token ผิดหรือขาดถูกปฏิเสธ และ cookie ผู้ใช้ไม่ถูกส่งต่อ
- ปิดบริการ Redirect/จำลอง timeout แล้วแสดง 503 แต่สมาชิกและหน้าจัดการลิงก์ยังทำงาน
- สร้าง ค้นหา แก้ชื่อ ลบ แบ่งหน้า และแยกสองบัญชียังถูกต้อง
- ตรวจ Desktop/Mobile และทดลองติดตั้งใหม่ตามขั้นตอนสองบริการ

ผลในเครื่องไม่แทนผลออนไลน์ รายการที่ยืนยันจริงและเหตุการณ์ 503 ชั่วคราวบันทึกใน [SUBMISSION.md](SUBMISSION.md#ผลออนไลน์หลัง-deploy-pr-7) ไม่ต้องจงใจหยุดบริการออนไลน์เพื่อทดสอบซ้ำในรอบเอกสาร
