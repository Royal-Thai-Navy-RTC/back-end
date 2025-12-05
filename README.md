# ระบบรายงานการฝึก การลา และแบบประเมิน – API Reference

เอกสารนี้สรุป endpoint ที่มีอยู่จริงในโค้ดปัจจุบันเท่านั้น (อันไหนไม่มีถูกลบออกแล้ว)

## ภาพรวมระบบ

- Base: `https://<host>/api`
- Auth: Bearer JWT ใน header `Authorization`
- Access token อายุ 24h (`/login`), ขอใหม่ผ่าน `/refresh-token`
- Timezone ตัวอย่าง: Asia/Bangkok (UTC+7)
- Rate limit: ทั้งระบบ 300 req/15m ต่อ IP, `/login` และ `/register` มี limit เฉพาะ (ค่าเริ่มต้น 20 ครั้ง/5m) และป้องกัน brute-force แบบหน่วงเวลา

## บทบาท

`OWNER` (อนุมัติขั้นสุดท้าย/ลาไปราชการ) · `ADMIN` (จัดการผู้ใช้/แดชบอร์ด) · `SUB_ADMIN` (ช่วยอนุมัติการลา) · `SCHEDULE_ADMIN` (จัดการตารางสอน/กิจกรรมเท่านั้น) · `FORM_CREATOR` (สร้าง/แก้ไขแบบฟอร์มประเมินเท่านั้น) · `EXAM_UPLOADER` (ส่ง/จัดการไฟล์คะแนนสอบเท่านั้น) · `TEACHER` (รายงานการฝึก/ลาราชการ) · `STUDENT`

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

## 5) Admin/Schedule – ตารางสอน/กิจกรรม (ใช้กับ FullCalendar)

- Auth: `ADMIN`/`OWNER`/`SCHEDULE_ADMIN` สำหรับ endpoint /admin/...
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

- `GET /admin/teacher-leaves/summary` — overview ฝั่งครู นับเฉพาะผู้ใช้ role = TEACHER
- `GET /admin/teacher-leaves` — query `status,adminStatus,limit<=200,includeOfficial`
- `GET /admin/teacher-leaves/current` — ผู้ที่กำลังลาปัจจุบัน
- `PATCH /admin/teacher-leaves/:id/status` — อนุมัติ/ปฏิเสธรอบแอดมิน

---

## 7) Teacher – รายงานการฝึก (TEACHER)

- `POST /teacher/training-reports`
- `GET /teacher/training-reports/latest` — query `limit` (default 5, max 20)
  - การส่งยอดต้องผูกกับตารางสอน: `subject` ต้องตรงกับ `title` ของ TeachingSchedule ของครูในวันนั้น มิฉะนั้นระบบจะไม่รับ

---

## 8) Teacher/Schedule Admin/Form Creator/Exam Uploader – การลา (TEACHER, SCHEDULE_ADMIN, FORM_CREATOR, EXAM_UPLOADER)

- `POST /teacher/leaves` — คำขอลาทั่วไป
- `GET /teacher/leaves` — query `limit`
- `PATCH /teacher/leaves/:id/cancel` — ยกเลิกคำขอลาของตัวเอง (ได้เฉพาะสถานะ PENDING)
- `POST /teacher/official-duty-leaves` — ลาไปราชการ
- `GET /teacher/official-duty-leaves` — query `limit`

---

## 9) Notifications – แจ้งเตือนงานคาบเรียน/ประเมินผล/งานมอบหมาย (ทุกบทบาทยกเว้น STUDENT)

- `GET /teacher/notifications` — ต้องใช้ token (ยกเว้น STUDENT); คืน reminder อัตโนมัติ (ไม่เก็บสถานะอ่าน)
  - ประเภท `TRAINING_REPORT_MISSING`: แจ้งเตือนส่งยอดนักเรียนก่อนเริ่มคาบ (เริ่มแจ้งล่วงหน้า 60 นาที ถ้ายังไม่มี TrainingReport ในวันเดียวกัน)
  - ประเภท `STUDENT_EVALUATION_MISSING`: แจ้งเตือนบันทึกผลประเมินนักเรียนหลังคาบ (เริ่มแจ้งล่วงหน้า 30 นาที ก่อนจบคาบ ถ้ายังไม่มี StudentEvaluation ในวันเดียวกัน)
  - ประเภท `TASK_ASSIGNED`: แจ้งงานที่ได้รับมอบหมายใหม่ (มีฟิลด์ `task` แนบข้อมูลงานและ `noteToAssignee` ถ้ามี)
  - อ้างอิงตารางสอน “วันนี้” ของครูเท่านั้น
  - query `page=1,pageSize<=50`; คืน `{ data, page, pageSize, total, totalPages }` โดยเรียงตาม `dueAt desc`
  - payload: `{ id,type,title,message,source,status,dueAt,schedule:{ id,title,start,end,location,companyCode,battalionCode },task:{ id,title,description,noteToAssignee,startDate,dueDate,priority,status,creator:{id,firstName,lastName,role} } }` (เวลาใน response เป็น UTC+7)
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

## 12) Soldier Intake – บันทึกข้อมูลทหารใหม่

- `GET /public/soldier-intake/status` — ตรวจสอบว่าเปิดรับแบบฟอร์มอยู่หรือไม่ (ไม่ต้อง login)
- `PATCH /admin/soldier-intake/status` — body `{ enabled: boolean }` เปิด/ปิดแบบฟอร์ม (ADMIN)
- `POST /soldier-intakes` — public form + upload บัตรประชาชน (multipart ฟิลด์ไฟล์ `file`); body fields: `firstName,lastName,citizenId,birthDate` (required) และ `weightKg,heightCm,serviceYears,bloodGroup,education,previousJob,religion,canSwim,specialSkills,addressLine,province,district,subdistrict,postalCode,email,phone,emergencyName,emergencyPhone,chronicDiseases[],foodAllergies[],drugAllergies[],medicalNotes`; ระบบบันทึก `idCardImageUrl` ไปที่ `/uploads/idcards/...`
- `GET /admin/soldier-intakes` (ADMIN) — query `page,pageSize,search` (ค้นหา firstName,lastName,citizenId,phone)
- `GET /admin/soldier-intakes/:id` (ADMIN) — ดูรายละเอียด intake
- `PUT /admin/soldier-intakes/:id` (ADMIN) — แก้ไข intake; รองรับอัปโหลดบัตรใหม่ (multipart `file`)
- `DELETE /admin/soldier-intakes/:id` (ADMIN) — ลบ intake
- `GET /admin/soldier-intakes-summary` (ADMIN) — สรุปจำนวน `{ total, sixMonths, oneYear, twoYears, educationCounts[], religionCounts[] }`; educationCounts คือ `{ value,label,count }` ครอบคลุมทุกตัวเลือกวุฒิการศึกษา อิง `serviceYears` (<=0.6,==1,==2) ส่วน religionCounts เป็น `{ value,label,count }` กลุ่มศาสนาที่ระบุมา

---

## 13) Evaluations – แบบประเมินครู

- `POST /evaluations/import` — upload Excel (`file`/`excel`/`upload`/`sheet`)
- `GET /evaluations` — query `page,pageSize,teacherId,subject,teacherName,evaluatorName,search`
- `GET /evaluations/:id`
- `PUT /evaluations/:id`
- `DELETE /evaluations/:id`
- `GET /evaluations/template/download`

---

## 14) Student Evaluations – แบบประเมินกองร้อย

Template (ADMIN/OWNER/FORM_CREATOR):

- `POST /admin/student-evaluation-templates` (ADMIN/OWNER/FORM_CREATOR) — body `{ name, description?, templateType (BATTALION|COMPANY|SERVICE), battalionCount?, teacherEvaluatorCount?, sections[] }`
  - `templateType = SERVICE` สำหรับแบบประเมินราชการ/รายบุคคล (ไม่ต้องส่ง battalionCount/teacherEvaluatorCount)
  - `templateType = BATTALION` ต้องส่ง `battalionCount, teacherEvaluatorCount` เป็นจำนวนเต็ม > 0
- `GET /admin/student-evaluation-templates` (ADMIN/OWNER/SUB_ADMIN/SCHEDULE_ADMIN/TEACHER/FORM_CREATOR) — query `includeInactive,search`
- `GET /admin/student-evaluation-templates/:id` (ADMIN/OWNER/FORM_CREATOR)
- `PUT /admin/student-evaluation-templates/:id` (ADMIN/OWNER/FORM_CREATOR)
- `DELETE /admin/student-evaluation-templates/:id` (ADMIN/OWNER/FORM_CREATOR)

Submission (ADMIN หรือ TEACHER):

- `POST /student-evaluations` — ต้องมี `templateId,subject,companyCode,battalionCode,answers[]`
  - หากใช้ templateType = `SERVICE` ให้ใส่ `templateId` ของเทมเพลต SERVICE แล้วส่งค่า:
    - `subject`: หัวข้อ/ชื่อการตรวจ (เช่น “ติดตามผลการฝึก” หรือ “ประเมินรายบุคคล”)
    - `companyCode`, `battalionCode`: ถ้าไม่ระบุจะใช้ค่าเริ่มต้น `SERVICE` ให้เอง; ถ้าต้องระบุหน่วย สามารถตั้งเป็นรหัสสั้นได้ เช่น `SRV01`, `UNITA`
    - `evaluationPeriod`: วันที่ตรวจ (ต้องส่งสำหรับ SERVICE)
    - `evaluationRound`: รอบการประเมิน (เช่น `ไตรมาส 1/2568`) — จำเป็นสำหรับ SERVICE
    - `evaluatorName`: ชื่อผู้ประเมิน — จำเป็นสำหรับ SERVICE
    - `summary`: หมายเหตุรวม
    - `overallScore`: คะแนนรวม (ถ้าไม่ส่ง ระบบจะรวมจากคะแนนแต่ละข้อ)
    - `answers[]`: `{ questionId, score, comment? }` ตามคำถามในเทมเพลต
    - ผู้ส่งผลต้องเป็น OWNER เท่านั้น (admin/teacher ไม่สามารถส่งผลของเทมเพลต SERVICE)
- `GET /student-evaluations` — query `templateId,companyCode,battalionCode,evaluatorId,page,pageSize<=200,includeAnswers`; response `{ data, page, pageSize, total, totalPages, summary, summaryByCompany }` (ค่าเริ่มต้นไม่ส่ง `answers` เพื่อความเร็ว; ส่ง `includeAnswers=true` หากต้องการรายละเอียดทุกข้อ)
  - `summary.totalEvaluations` = จำนวนรายการที่ตรงเงื่อนไข
  - `summary.totalScore` = ผลรวมคะแนนคำตอบทุกข้อ (ทุก evaluation ที่ตรงเงื่อนไข)
  - `summary.averageScore` = `summary.totalScore / จำนวนคำตอบทั้งหมด` (ปัดสองทศนิยม; null ถ้าไม่มีคำตอบ)
  - `summaryByCompany[].totalEvaluations` = จำนวน evaluation ต่อ (battalion,company)
  - `summaryByCompany[].totalScore` = ผลรวม `overallScore` ของ evaluation ในกองพัน/กองร้อยนั้น
  - `summaryByCompany[].averageOverallScore` = `totalScore / totalEvaluations` (ค่าเฉลี่ยคะแนนรวมของแต่ละ evaluation ในกองพัน/กองร้อยนั้น; null ถ้าไม่มีข้อมูล)
- `GET /student-evaluations/comparison` — คืนข้อมูลเปรียบเทียบคะแนนเฉลี่ยสำหรับทำกราฟ (กรองด้วย `templateId,companyCode,battalionCode,evaluatorId,templateType` ได้ ยกเว้น templateType=SERVICE)
  - response `{ comparison: { battalions: [{ battalionCode,totalEvaluations,totalScore,averageOverallScore,companies:[{ battalionCode,companyCode,totalEvaluations,totalScore,averageOverallScore }] }], companies:[...] } }`
  - รายการถูกจัดอันดับตาม `averageOverallScore` จากมากไปน้อย (ค่าเฉลี่ยปัดสองทศนิยม)
  - ส่ง `battalionCodes` และ `companyCodes` (คั่น comma) เพื่อให้ผลลัพธ์เติมชุดข้อมูลครบทุกกองพัน/กองร้อยแม้ยังไม่มีคะแนน เช่น `?battalionCodes=พัน1,พัน2,พัน3,พัน4&companyCodes=ร้อย1,ร้อย2,ร้อย3,ร้อย4,ร้อย5`
- `GET /student-evaluations/:id`
- `PUT /student-evaluations/:id`
- `DELETE /student-evaluations/:id`

---

## 15) Exam Results – นำเข้าคะแนนสอบ (ADMIN/OWNER/TEACHER/SUB_ADMIN/SCHEDULE_ADMIN/FORM_CREATOR/EXAM_UPLOADER)

- `POST /api/exam-results/import` (รวม `EXAM_UPLOADER`) — upload Excel (`file`/`excel`/`upload`/`sheet`) ต้องมีคอลัมน์อย่างน้อย: `ประทับเวลา`, `คะแนน`, `ยศ - ชื่อ - สกุล`; รองรับ `หมายเลข ทร. 5 ตัว`, `สังกัด` ถ้ามี
- `GET /api/exam-results` — query `page,pageSize,search,unit,navyNumber,sort`; คืน `{ items, page, pageSize, total, totalPages }`
  - `sort`: รองรับ `id`, `-id`, `timestamp`, `-timestamp` (ค่าเริ่มต้น `-timestamp`)
- `GET /api/exam-results/summary` — query `battalionCodes,companyCodes` (comma separated); คืน `{ battalions: [{ battalionCode, averageScore, total, companies: [{ battalionCode, companyCode, averageScore, total }] }] }` (ค่าเริ่มต้น battalion=1-4, company=1-5)
- `DELETE /api/exam-results/:id` — ลบรายการผลสอบ
- `DELETE /api/exam-results` — ลบผลสอบทั้งหมด
- `GET /api/exam-results/overview` — สรุปจำนวนทั้งหมด ค่าเฉลี่ยคะแนน และรายการล่าสุด `{ overview: { total, averageScore, latest } }`
- `GET /api/exam-results/export` — ส่งออกไฟล์ Excel แยก sheet ตามกองร้อย (ดึงจากสังกัดรูปแบบ `ร้อย.<เลข> พัน.<เลข>`)

---

## 16) Owner – มอบหมายงาน / ติดตามสถานะ

- `POST /admin/tasks` (OWNER) — body `{ title (required), assigneeId (required), startDate (required), durationDays?, dueDate?, priority? (HIGH|MEDIUM|LOW), description?, noteToAssignee?, status? }`  
  - ถ้าไม่ส่ง `dueDate` ให้ระบุ `durationDays` ระบบจะคำนวณกำหนดส่งจาก startDate  
  - ตัวอย่าง:
```http
POST /api/admin/tasks
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "จัดทำแผนฝึกประจำสัปดาห์",
  "assigneeId": 12,
  "startDate": "2025-12-04",
  "durationDays": 3,
  "priority": "HIGH",
  "description": "สรุปขั้นตอน เป้าหมาย และเอกสารแนบ",
  "noteToAssignee": "ขออัปเดตความคืบหน้าทุก 2 วัน"
}
```
- `GET /admin/tasks` (ทุก role ยกเว้น STUDENT; OWNER/ADMIN เห็นทั้งหมด, ผู้รับเห็นของตัวเอง) — query `assigneeId,createdById,status,priority`; คืน `{ data: [...] }`
- `PATCH /admin/tasks/:id` (ทุก role ยกเว้น STUDENT) — ส่ง `{ status, submissionNote }`; ผู้รับงานอัปเดตสถานะของตนเองได้, OWNER/ADMIN อัปเดตได้ทุกงาน  
  - ลำดับสถานะเดินหน้าเท่านั้น: `PENDING -> IN_PROGRESS -> DONE` (หรือ `CANCELLED` เพื่อยุติงาน); ไม่สามารถย้อนกลับไปสถานะก่อนหน้าได้ และงานที่ปิด (DONE/CANCELLED) แก้ไขไม่ได้
- `DELETE /admin/tasks/:id` (OWNER) — ลบงาน

---

## 17) Static Files

- `GET /uploads/avatars/:filename` — public

---

## เช็กลิสต์สั้น ๆ

1. สมัครหรือให้ ADMIN สร้างบัญชี (ถ้า role=TEACHER ต้องส่ง `division`)
2. `/login` รับ access/refresh token แล้วแนบ `Authorization: Bearer <token>`
3. access token หมดอายุให้เรียก `/refresh-token`
4. ใช้ endpoint ตามบทบาทในส่วนที่เกี่ยวข้อง
