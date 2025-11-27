# ระบบรายงานการฝึก การลา และแบบประเมิน – API Reference

เอกสารนี้สรุป endpoint ที่มีอยู่จริงในโค้ดปัจจุบันเท่านั้น (อันไหนไม่มีถูกลบออกแล้ว)

## ภาพรวมระบบ

- Base: `https://<host>/api`
- Auth: Bearer JWT ใน header `Authorization`
- Access token อายุ 24h (`/login`), ขอใหม่ผ่าน `/refresh-token`
- Timezone ตัวอย่าง: Asia/Bangkok (UTC+7)
- Rate limit: ทั้งระบบ 300 req/15m ต่อ IP, `/login` และ `/register` มี limit เฉพาะ (ค่าเริ่มต้น 20 ครั้ง/5m) และป้องกัน brute-force แบบหน่วงเวลา

## บทบาท

`OWNER` (อนุมัติขั้นสุดท้าย/ลาไปราชการ) · `ADMIN` (จัดการผู้ใช้/แดชบอร์ด) · `SUB_ADMIN` (ช่วยอนุมัติการลา) · `TEACHER` (รายงานการฝึก/ลาราชการ) · `STUDENT`

## รูปแบบ Error ทั่วไป

```json
{ "message": "อธิบายสั้น", "detail": "ถ้ามี", "errors": ["ถ้ามี"] }
```

สถานะที่ใช้: 400/401/403/404/409/500

---

## 1) Authentication

- `POST /register` (no auth) — รับ `username,password,firstName,lastName,email,phone`; ฟิลด์เพิ่มเติม `rank,birthDate,fullAddress,education,position,medicalHistory,role,isActive`; ถ้า `role=TEACHER` ต้องส่ง `division`; แนบ avatar ได้ (multipart/base64/path)
- `POST /login` — body `username,password`; คืน access/refresh token
- `POST /refresh-token` — body `{refreshToken}` หรือ header `x-refresh-token`

---

## 2) โปรไฟล์ตนเอง (ต้องล็อกอิน)

- `GET /me` — โปรไฟล์ปัจจุบัน
- `PUT /me` — แก้ไขฟิลด์ที่อนุญาต (ชื่อ เบอร์ ที่อยู่ การแพทย์ ฯลฯ)
- `POST /me/avatar` — upload avatar (multipart หรือ path)
- `POST /me/change-password` — body `{currentPassword,newPassword}`

---

## 3) Admin – จัดการผู้ใช้ (ADMIN)

- `GET /admin/users` — query `page,pageSize<=200,search,role`
- `GET /admin/users/personal-search` — ค้นข้อมูลส่วนตัว (q/query, limit<=200)
- `GET /admin/users/students` · `GET /admin/users/teachers`
- `GET /admin/users/:id` · `GET /admin/users/students/:id` · `GET /admin/users/teachers/:id` — คืนโปรไฟล์พร้อมสรุป `evaluationStats` (สถิติ “นักเรียนประเมินครู”: จำนวนแบบ ค่าเฉลี่ย rating ใบล่าสุด), `teacherEvaluationStats` (สถิติ “ครูประเมินนักเรียน”: จำนวน/คะแนนเฉลี่ย/วันที่ส่งล่าสุด) และ `leaveStats` (ยอดการลา แยกสถานะ + รายการล่าสุดถ้ามี)
- `POST /admin/users` — สร้างผู้ใช้ (avatar optional, ถ้า role=TEACHER ต้องมี `division`)
- `PUT /admin/users/:id` — อัปเดตข้อมูลกว้าง (รวม role/isActive/password/division)
- `POST /admin/users/:id/avatar` — อัปโหลดรูปแทนผู้ใช้
- `DELETE /admin/users/deactivate/:id` — ปิดการใช้งาน (isActive=false)
- `PATCH /admin/users/activate/:id` — เปิดใช้งาน

---

## 4) Admin – แดชบอร์ดรายงานการฝึก (ADMIN)

- `GET /admin/training-reports` — query `search`; คืน overview + teacherStats + recentReports

---

## 5) Admin – ตารางสอน/กิจกรรม (ใช้กับ FullCalendar)

- `POST /admin/teaching-schedules` — body `{ title, start, end?, allDay?, description?, location?, companyCode?, battalionCode?, color?, teacherId? }` (end ไม่ส่งจะใช้ค่าเดียวกับ start; ถ้าไม่ส่ง `color` จะตั้งเป็นสีน้ำเงิน `#1E90FF`)
- ตัวอย่าง:
```http
POST /api/admin/teaching-schedules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "สอนยุทธวิธีทางเรือ",
  "start": "2025-12-01T09:00:00+07:00",
  "end": "2025-12-01T11:00:00+07:00",
  "location": "ห้องเรียน 2",
  "companyCode": "ร้อย.1",
  "battalionCode": "พัน.ฝึก",
  "color": "#F39C12",
  "teacherId": 12,
  "description": "ภาคทฤษฎี + ถามตอบ",
  "allDay": false
}
```
- `GET /teaching-schedules` — ไม่ต้องใช้ token (มี rate limit); query `start,end,teacherId,page,pageSize<=200`; คืน `{ data, page, pageSize, total, totalPages }` เรียงตามเวลา (กรองช่วงวันที่เพื่อโหลดเฉพาะที่ต้องแสดง เช่น view ของ FullCalendar)  
  หมายเหตุ: ระบบตีความเวลาเป็น UTC+7 เสมอ (ถ้าส่งสตริงเวลาไม่ระบุ timezone จะถูกบังคับเป็น +07:00)
- `PUT /admin/teaching-schedules/:id` — แก้ไขข้อมูลตารางสอน/กิจกรรม
- `DELETE /admin/teaching-schedules/:id` — ลบรายการ

---

## 6) Library – คลังเอกสาร/ไฟล์

- Base path `.../api/library`
- `GET /library` — public list; query `page=1,pageSize<=100,search,category,includeInactive` (ถ้าไม่ส่ง `includeInactive` จะซ่อน `isActive=false`); คืน `{ data, page, pageSize, total, totalPages }` เรียงตาม `updatedAt desc`
- `POST /library` (ADMIN/OWNER) — `multipart/form-data` พร้อมไฟล์หนังสือ (ฟิลด์ `file`/`book`/`document`, รองรับ PDF/EPUB ไม่เกิน 100MB); body fields `title (required), description?, category?, coverUrl?, isActive?`; ระบบจะสร้าง `fileUrl` ชี้ไปยัง `/uploads/library/...`; คืน `{ item }`
- `PUT /library/:id` (ADMIN/OWNER) — อัปเดตบางส่วน; ถ้าแนบไฟล์ใหม่จะทับไฟล์เดิม; ต้องไม่ส่ง `title` ว่าง; คืน `{ item }`
- `DELETE /library/:id` (ADMIN/OWNER) — soft delete ตั้ง `isActive=false`; ตอบ 204
- ฟิลด์หลัก: `id,title,description?,category?,fileUrl,coverUrl?,isActive,createdAt,updatedAt`

---

## 6) Admin/SUB_ADMIN – การลา (ผู้อนุมัติรอบแอดมินหรือผู้ช่วย)

- `GET /admin/teacher-leaves/summary`
- `GET /admin/teacher-leaves` — query `status,adminStatus,limit<=200,includeOfficial`
- `GET /admin/teacher-leaves/current` — ผู้ที่กำลังลาปัจจุบัน
- `PATCH /admin/teacher-leaves/:id/status` — อนุมัติ/ปฏิเสธรอบแอดมิน

---

## 7) Teacher – รายงานการฝึก (TEACHER)

- `POST /teacher/training-reports`
- `GET /teacher/training-reports/latest` — query `limit` (default 5, max 20)
  - การส่งยอดต้องผูกกับตารางสอน: `subject` ต้องตรงกับ `title` ของ TeachingSchedule ของครูในวันนั้น มิฉะนั้นระบบจะไม่รับ

---

## 8) Teacher – การลา (TEACHER)

- `POST /teacher/leaves` — คำขอลาทั่วไป
- `GET /teacher/leaves` — query `limit`
- `PATCH /teacher/leaves/:id/cancel` — ยกเลิกคำขอลาของตัวเอง (ได้เฉพาะสถานะ PENDING)
- `POST /teacher/official-duty-leaves` — ลาไปราชการ
- `GET /teacher/official-duty-leaves` — query `limit`

---

## 9) Teacher – แจ้งเตือนงานคาบเรียน/ประเมินผล (TEACHER)

- `GET /teacher/notifications` — ต้องใช้ token ครูผู้สอน; คืน reminder อัตโนมัติ (ไม่เก็บสถานะอ่าน)
  - ประเภท `TRAINING_REPORT_MISSING`: แจ้งเตือนส่งยอดนักเรียนก่อนเริ่มคาบ (เริ่มแจ้งล่วงหน้า 60 นาที ถ้ายังไม่มี TrainingReport ในวันเดียวกัน)
  - ประเภท `STUDENT_EVALUATION_MISSING`: แจ้งเตือนบันทึกผลประเมินนักเรียนหลังคาบ (เริ่มแจ้งล่วงหน้า 30 นาที ก่อนจบคาบ ถ้ายังไม่มี StudentEvaluation ในวันเดียวกัน)
  - อ้างอิงตารางสอน “วันนี้” ของครูเท่านั้น
  - query `page=1,pageSize<=50`; คืน `{ data, page, pageSize, total, totalPages }` โดยเรียงตาม `dueAt desc`
  - payload: `{ id,type,title,message,source,status,dueAt,schedule:{ id,title,start,end,location,companyCode,battalionCode } }` (เวลาใน response เป็น UTC+7)
- `PATCH /teacher/notifications/read` — body `{ ids: [string] }` เพื่อทำสถานะอ่าน (บันทึกลงฐาน)

---

## 10) Owner – แจ้งเตือนครูที่ยังไม่ส่ง/ประเมิน (OWNER)

- `GET /owner/notifications` — ต้องใช้ token OWNER; คืน reminder อัตโนมัติของคาบที่สอนเสร็จแล้วภายใน 14 วันที่ผ่านมา (มองล่วงหน้า 1 วัน)
  - `TRAINING_REPORT_MISSING`: ครูยังไม่ส่งยอดนักเรียนในวันเดียวกับคาบสอน
  - `STUDENT_EVALUATION_MISSING`: ครูยังไม่บันทึกผลประเมินนักเรียนในวันเดียวกับคาบสอน
  - อ้างอิงตารางสอน “วันนี้” เท่านั้น และจะแจ้งเมื่อคาบจบแล้ว
  - query `page=1,pageSize<=100`; คืน `{ data, page, pageSize, total, totalPages }` เรียงตาม `dueAt desc`
  - payload: `{ id,type,title,message,source,status,dueAt,teacher:{id,name,rank},schedule:{ id,title,start,end,location,companyCode,battalionCode } }` (เวลาใน response เป็น UTC+7)
- `PATCH /owner/notifications/read` — body `{ ids: [string] }` เพื่อทำสถานะอ่าน (บันทึกลงฐาน)

---

## 11) Owner – อนุมัติขั้นสุดท้าย (OWNER)

- `GET /owner/teacher-leaves` — query `status,limit` (เฉพาะที่ admin อนุมัติแล้ว)
- `PATCH /owner/teacher-leaves/:id/status`
- `GET /owner/official-duty-leaves` — query `status,limit`
- `PATCH /owner/official-duty-leaves/:id/status`

---

## 12) Evaluations – แบบประเมินครู

- `POST /evaluations/import` — upload Excel (`file`/`excel`/`upload`/`sheet`)
- `GET /evaluations` — query `page,pageSize,teacherId,subject,teacherName,evaluatorName,search`
- `GET /evaluations/:id`
- `PUT /evaluations/:id`
- `DELETE /evaluations/:id`
- `GET /evaluations/template/download`

---

## 13) Student Evaluations – แบบประเมินกองร้อย

Template (ADMIN):

- `POST /admin/student-evaluation-templates`
- `GET /admin/student-evaluation-templates` — query `includeInactive,search`
- `GET /admin/student-evaluation-templates/:id`
- `PUT /admin/student-evaluation-templates/:id`
- `DELETE /admin/student-evaluation-templates/:id`

Submission (ADMIN หรือ TEACHER):

- `POST /student-evaluations` — ต้องมี `templateId,subject,companyCode,battalionCode,answers[]`
- `GET /student-evaluations` — query `templateId,companyCode,battalionCode,evaluatorId,page,pageSize<=200,includeAnswers`; response `{ data, page, pageSize, total, totalPages, summary, summaryByCompany }` (ค่าเริ่มต้นไม่ส่ง `answers` เพื่อความเร็ว; ส่ง `includeAnswers=true` หากต้องการรายละเอียดทุกข้อ)
  - `summary.totalEvaluations` = จำนวนรายการที่ตรงเงื่อนไข
  - `summary.totalScore` = ผลรวมคะแนนคำตอบทุกข้อ (ทุก evaluation ที่ตรงเงื่อนไข)
  - `summary.averageScore` = `summary.totalScore / จำนวนคำตอบทั้งหมด` (ปัดสองทศนิยม; null ถ้าไม่มีคำตอบ)
  - `summaryByCompany[].totalEvaluations` = จำนวน evaluation ต่อ (battalion,company)
  - `summaryByCompany[].totalScore` = ผลรวม `overallScore` ของ evaluation ในกองพัน/กองร้อยนั้น
  - `summaryByCompany[].averageOverallScore` = `totalScore / totalEvaluations` (ค่าเฉลี่ยคะแนนรวมของแต่ละ evaluation ในกองพัน/กองร้อยนั้น; null ถ้าไม่มีข้อมูล)
- `GET /student-evaluations/:id`
- `PUT /student-evaluations/:id`
- `DELETE /student-evaluations/:id`

---

## 12) Static Files

- `GET /uploads/avatars/:filename` — public

---

## เช็กลิสต์สั้น ๆ

1. สมัครหรือให้ ADMIN สร้างบัญชี (ถ้า role=TEACHER ต้องส่ง `division`)
2. `/login` รับ access/refresh token แล้วแนบ `Authorization: Bearer <token>`
3. access token หมดอายุให้เรียก `/refresh-token`
4. ใช้ endpoint ตามบทบาทในส่วนที่เกี่ยวข้อง
