# ระบบรายงานการฝึกและการลา – API Reference

เอกสารฉบับนี้รวบรวมรายละเอียดของทุกเส้นทาง (endpoint) ในระบบ รวมทั้งสิ่งที่ต้องส่งและตัวอย่างการตอบกลับ เพื่อให้ทีมพัฒนาหรือผู้ทดสอบสามารถใช้งาน REST API ได้อย่างถูกต้อง

## ภาพรวมระบบ
- Base URL เริ่มต้น: `https://<host>/api`
- การพิสูจน์ตัวตน: ส่ง `Authorization: Bearer <accessToken>` ในทุก endpoint ที่มีข้อจำกัดสิทธิ์
- Access token อายุ 24 ชั่วโมง (ตาม `/login`), ออก token ใหม่ด้วย `/refresh-token`
- เขตเวลาในตัวอย่างใช้ `Asia/Bangkok` (UTC+7)
- Rate Limit:
  - Global: 300 คำขอ / 15 นาที ต่อ IP (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`)
  - Auth (login/register): 20 ครั้ง / 5 นาที (`AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX_ATTEMPTS`)
  - Login ผิดซ้ำจะเพิ่มเวลารอแบบทวีคูณ (`LOGIN_FAIL_THRESHOLD`, `LOGIN_FAIL_BASE_DELAY_MS`, `LOGIN_FAIL_MAX_DELAY_MS`, `LOGIN_FAIL_RESET_MS`)

## บทบาทและสิทธิ์
| Role | คำอธิบาย | สิทธิ์หลัก |
| --- | --- | --- |
| `OWNER` | เจ้าของระบบ/ผู้บังคับบัญชาสูงสุด | เห็นทุกอย่าง, อนุมัติขั้นสุดท้ายของการลา, อนุมัติลาไปราชการ |
| `ADMIN` | ผู้ดูแลระบบ | จัดการผู้ใช้ทั้งหมด, ดูแดชบอร์ดรายงาน, อนุมัติรอบแรกของคำขอลาทั่วไป |
| `SUB_ADMIN` | ผู้ช่วยแอดมิน | ทำหน้าที่เหมือนครูผู้สอน + อนุมัติการลาทั่วไป |
| `TEACHER` | ครูผู้สอน | ส่งยอดรายงานการฝึก, ขออนุมัติการลา/ไปราชการ |
| `STUDENT` | นักเรียน | ใช้งานทั่วไป, เข้าถึงเฉพาะข้อมูลตนเอง |

## รูปแบบข้อผิดพลาดที่ใช้ร่วมกัน
```json
{
  "message": "ข้อความอธิบายสั้น ๆ",
  "detail": "(อาจมี) รายละเอียดเชิงเทคนิค",
  "errors": ["(อาจมี) รายการฟิลด์ที่ผิดพลาด"]
}
```
รหัสสถานะที่พบบ่อย: `400` (validation), `401` (ข้อมูลไม่ถูกต้อง), `403` (ไม่มีสิทธิ์), `404` (ไม่พบข้อมูล), `409` (ข้อมูลซ้ำ), `500` (ข้อผิดพลาดฝั่งเซิร์ฟเวอร์)

---

## 1) Authentication

### POST /api/register
- ไม่ต้องใช้ token
- Content-Type: `application/json` หรือ `multipart/form-data`
- ต้องระบุ: `username`, `password`, `firstName`, `lastName`, `email`, `phone`
- ฟิลด์เพิ่มเติม: `rank`, `birthDate`, `fullAddress`, `education`, `position`, `emergencyContactName`, `emergencyContactPhone`, `medicalHistory`, `role` (ค่าปริยาย STUDENT)
- ข้อมูลส่วนตัวเพิ่มเติม (optional): `chronicDiseases[]`, `drugAllergies[]`, `foodAllergies[]`, `religion`, `specialSkills`, `secondaryOccupation`
- แนบรูปโปรไฟล์: ฟิลด์ `avatar`/`file` หรือส่ง Base64 ใน `profileImage`

```http
POST /api/register HTTP/1.1
Content-Type: application/json

{
  "username": "peter",
  "password": "Sup3rSecret!",
  "firstName": "Peter",
  "lastName": "Wong",
  "email": "peter@example.mil",
  "phone": "0812345678",
  "rank": "LIEUTENANT",
  "birthDate": "1990-05-20",
  "fullAddress": "123/45 ฐานทัพเรือสัตหีบ"
}
```

**201** `{"message":"User registered successfully"}`

### POST /api/login
- Body: `username`, `password`
- Response คืน access/refresh token + ข้อมูลผู้ใช้สั้น ๆ

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "1b5c9f...",
  "tokenType": "Bearer",
  "expiresIn": "24h",
  "user": { "id": 1, "username": "admin", "role": "ADMIN" }
}
```

### POST /api/refresh-token
- Body: `{ "refreshToken": "..." }` หรือส่ง header `x-refresh-token`
- Response โครงสร้างเดียวกับ `/login`

---

## 2) โปรไฟล์ผู้ใช้ (ต้องมี JWT)

### GET /api/me
ส่ง token ของผู้ใช้ปัจจุบันเพื่อตรวจสอบข้อมูลตนเอง

```json
{
  "id": 12,
  "username": "teacher01",
  "role": "TEACHER",
  "firstName": "เอกชัย",
  "lastName": "สถิตย์",
  "rank": "นาวาโท",
  "email": "teacher01@example.mil",
  "avatar": "/uploads/avatars/user-12.png"
}
```

### PUT /api/me
แก้ไขฟิลด์อนุญาต (ชื่อ, เบอร์, การศึกษา ฯลฯ)

```http
PUT /api/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "0891234567",
  "education": "นิติศาสตร์",
  "medicalHistory": "แพ้อาหารทะเล"
}
```

Response: โปรไฟล์ล่าสุด (200)

### POST /api/me/avatar
- `multipart/form-data`
- ฟิลด์ไฟล์ที่รับ: `avatar`/`file`/`image`/`photo`/`picture`
- Response: `{ "message": "อัปโหลดรูปโปรไฟล์สำเร็จ", "avatar": "/uploads/avatars/user-12.png" }`

### POST /api/me/change-password
- Body: `{ "currentPassword": "...", "newPassword": "..." }`
- Response 200: `{"message":"เปลี่ยนรหัสผ่านสำเร็จ"}`

---

## 3) Admin – จัดการผู้ใช้ (ต้องมี role ADMIN)

### GET /api/admin/users
- Query: `page`, `pageSize` (สูงสุด 100), `search`, `role`
- Response:
```json
{
  "data": [{ "id": 1, "username": "admin", "role": "ADMIN", "email": "admin@example.mil", "isActive": true }],
  "page": 1,
  "pageSize": 10,
  "total": 37,
  "totalPages": 4
}
```

### GET /api/admin/users/personal-search
- Auth: ADMIN/OWNER
- Query: `q` หรือ `query` (คำค้น), `limit` (สูงสุด 200)
- ค้นหาใน username/email/phone รวมถึง medicalHistory, religion, specialSkills, chronicDiseases, drugAllergies, foodAllergies และข้อมูลที่อยู่
- Response: `{ "data": [...], "total": 12 }`

### GET /api/admin/users/students
เหมือน `/admin/users` แต่บังคับ role = STUDENT

### GET /api/admin/users/teachers
เหมือนด้านบนแต่ role = TEACHER

### GET /api/admin/users/:id
คืนโปรไฟล์เต็ม (พร้อม rank, ที่อยู่, เบอร์ ฯลฯ)

### GET /api/admin/users/students/:id
ตรวจสอบว่า role = STUDENT ไม่เช่นนั้นตอบ 400

### GET /api/admin/users/teachers/:id
ตรวจสอบว่า role = TEACHER

ตัวอย่าง response รายบุคคล:
```json
{
  "id": 22,
  "username": "student07",
  "role": "STUDENT",
  "firstName": "กิตติ",
  "lastName": "ศรีสุข",
  "email": "student07@example.mil",
  "phone": "0812340007",
  "isActive": true
}
```

### POST /api/admin/users
- ฟิลด์บังคับเหมือน `/register`
- รับไฟล์ avatar ผ่าน multipart หรือส่ง path/base64
- Response 201: โปรไฟล์ผู้ใช้ใหม่

### PUT /api/admin/users/:id
- แก้ไขฟิลด์กว้าง (รวม `role`, `isActive`, `rank`, `password`)
- หากส่ง `password` ระบบจะ hash ให้

```json
{
  "id": 45,
  "username": "teacher99",
  "role": "TEACHER",
  "phone": "0823456789",
  "isActive": true
}
```

### POST /api/admin/users/:id/avatar
- Upload รูปแทนผู้ใช้ ระบบตั้งชื่อ `user-<id>.ext`
- Response 200: `{ "message": "อัปโหลดรูปโปรไฟล์ผู้ใช้สำเร็จ", "avatar": "/uploads/avatars/user-45.png" }`

### DELETE /api/admin/users/deactivate/:id
- Soft delete (ตั้ง `isActive=false`)

### PATCH /api/admin/users/activate/:id
- เปิดใช้งาน (`isActive=true`)

ทั้งสอง endpoint ตอบ `{ "message": "...", "user": { "id": <id>, "isActive": <bool> } }`

---

## 4) Admin – แดชบอร์ดรายงานการฝึก

### GET /api/admin/training-reports
- Query: `search`
- Response summarises overview + สถิติครู + รายการล่าสุด

```json
{
  "overview": {
    "totalReports": 145,
    "totalTrainingRounds": 57,
    "totalParticipants": 5120,
    "totalTeachersSubmitted": 23,
    "lastReportAt": "2025-11-18T02:45:00.000Z"
  },
  "teacherStats": [
    {
      "teacherId": 12,
      "teacherName": "นาวาโท เอกชัย สถิตย์",
      "rank": "นาวาโท",
      "position": "ครูฝึก",
      "totalReports": 8,
      "totalParticipants": 420,
      "company": "ร้อย.3",
      "battalion": "พัน.ฝึก",
      "latestSubject": "ยุทธวิธีหมู่เรือ",
      "latestTrainingDate": "2025-11-17T00:00:00.000Z",
      "latestReportAt": "2025-11-17T14:00:00.000Z"
    }
  ],
  "recentReports": [
    {
      "id": 301,
      "teacherId": 12,
      "subject": "การบังคับเรือ",
      "participantCount": 30,
      "durationHours": 3,
      "trainingDate": "2025-11-17T00:00:00.000Z",
      "createdAt": "2025-11-17T14:00:00.000Z"
    }
  ]
}
```

---

## 5) Admin – จัดการผู้ใช้
(เฉพาะผู้ที่ role = ADMIN เท่านั้น; OWNER ใช้ endpoint /api/owner/... สำหรับการอนุมัติขั้นสุดท้าย)

### GET /api/admin/teacher-leaves
- Query: `status` (สถานะสุดท้าย), `adminStatus` (สถานะรอบแอดมิน), `limit` (≤200), `includeOfficial` (ค่าเริ่มต้น true — ใส่ `false` หากต้องการดูเฉพาะลาทั่วไป)
- ใช้ดูคำขอลาทั่วไปและลาไปราชการ รวมถึงค่าที่แอดมินอนุมัติไว้แล้ว (`adminApprovalStatus`)

**Response 200**
```json
{
  "data": [
    {
      "id": 51,
      "teacherId": 12,
      "teacher": { "firstName": "เอกชัย", "lastName": "สถิตย์", "rank": "นาวาโท" },
      "leaveType": "ลากิจ",
      "destination": "บ้านพักนครปฐม",
      "reason": "ธุระครอบครัว",
      "startDate": "2025-11-20T00:00:00.000Z",
      "endDate": "2025-11-22T00:00:00.000Z",
      "status": "PENDING",
      "adminApprovalStatus": "APPROVED",
      "ownerApprovalStatus": "PENDING",
      "isOfficialDuty": false,
      "createdAt": "2025-11-18T04:00:00.000Z"
    }
  ]
}
```

### PATCH /api/admin/teacher-leaves/:id/status
- Body: `{ "status": "APPROVED" }` หรือ `REJECTED`
- ใช้สำหรับ “รอบที่ 1” เฉพาะคำขอลาทั่วไป (`isOfficialDuty=false`) ก่อนส่งต่อให้ OWNER
- เมื่ออนุมัติแล้ว ระบบตั้ง `ownerApprovalStatus = "PENDING"` เพื่อรอเจ้าของระบบตัดสิน

**Response 200**
```json
{
  "message": "อัปเดตสถานะการลาสำเร็จ",
  "leave": {
    "id": 51,
    "status": "PENDING",
    "adminApprovalStatus": "APPROVED",
    "ownerApprovalStatus": "PENDING"
  }
}
```

### GET /api/admin/teacher-leaves/current
- คืนรายชื่อผู้ที่ “กำลังลาปัจจุบัน” (status = APPROVED และช่วงวันยังกินเวลาปัจจุบัน) ทั้งลาทั่วไปและลาไปราชการ
- Response `{ "data": [ { leave }, ... ] }`

## 6) Teacher – การรายงานการฝึก


## 6) Teacher – รายงานการฝึก

### POST /api/teacher/training-reports
- ใช้เฉพาะ role TEACHER
- Body ตัวอย่าง:
```json
{
  "subject": "การใช้อาวุธประจำกาย",
  "participantCount": 35,
  "company": "ร้อย.1",
  "battalion": "พัน.ฝึก",
  "trainingDate": "2025-11-17",
  "trainingTime": "09:00",
  "location": "ลานฝึกกลาง",
  "durationHours": 4,
  "notes": "ฝนตกเล็กน้อย"
}
```
- Response 201: `{ "message": "บันทึกยอดนักเรียนสำเร็จ", "report": { ... } }`

### GET /api/teacher/training-reports/latest
- Query `limit` (ดีฟอลต์ 5, สูงสุด 20)
- Response `{ "data": [ { report }, ... ] }`

---

## 7) Teacher – การลา/ลาไปราชการ

### POST /api/teacher/leaves
- Body: `leaveType`, `startDate`, `endDate?`, `destination?`, `reason?`
- Response 201: `{ "message": "บันทึกการลาสำเร็จ", "leave": { ... } }`

### GET /api/teacher/leaves
- Query: `limit`
- Response `{ "data": [ { leave }, ... ] }`

> หมายเหตุ: คำขอลาทั่วไปจะเข้าสู่รอบตรวจของแอดมินก่อน (`/api/admin/teacher-leaves/:id/status`) และเมื่อแอดมินอนุมัติแล้ว Owner จะอนุมัติรอบสุดท้ายที่ `/api/owner/teacher-leaves/:id/status`

### POST /api/teacher/official-duty-leaves
- ใช้สำหรับลาไปราชการ (`isOfficialDuty=true`)
- Response 201: `{ "message": "บันทึกคำขอลาไปราชการสำเร็จ", "leave": { ..., "ownerApprovalStatus": "PENDING" } }`

### GET /api/teacher/official-duty-leaves
- Query: `limit`
- Response `{ "data": [ { officialDutyLeave }, ... ] }`

ตัวอย่างข้อมูล leave:
```json
{
  "id": 51,
  "teacherId": 12,
  "leaveType": "ลาไปศึกษาดูงาน",
  "destination": "กองการศึกษา",
  "reason": "เข้าร่วมอบรม",
  "startDate": "2025-11-20T00:00:00.000Z",
  "endDate": "2025-11-22T00:00:00.000Z",
  "status": "PENDING",
  "isOfficialDuty": true,
  "ownerApprovalStatus": "PENDING"
}
```

---

## 8) Owner – อนุมัติขั้นสุดท้าย

### GET /api/owner/teacher-leaves
- Auth: OWNER
- Query: `status` (PENDING/APPROVED/REJECTED), `limit`
- คืนเฉพาะคำขอลาทั่วไปที่ผ่านแอดมินแล้ว (`adminApprovalStatus = APPROVED`) เพื่อตัดสินรอบสุดท้าย

### PATCH /api/owner/teacher-leaves/:id/status
- Body: `{ "status": "APPROVED" }` หรือ `REJECTED`
- ใช้สรุปผลรอบสุดท้ายหลังจากแอดมินอนุมัติแล้ว
- Response `{ "message": "อัปเดตสถานะการลาสำเร็จ", "leave": { ... } }`

### GET /api/owner/official-duty-leaves
- Auth: OWNER
- Query: `status`, `limit`
- ใช้ตรวจคำขอลาไปราชการทั้งหมด (ไม่ต้องผ่านแอดมิน)

### PATCH /api/owner/official-duty-leaves/:id/status
- Body: `{ "status": "APPROVED" }` หรือ `REJECTED`
- OWNER เป็นผู้ตัดสินเพียงขั้นเดียว
- Response `{ "message": "อัปเดตสถานะลาไปราชการสำเร็จ", "leave": { ... } }`

---

## 9) Evaluations – แบบประเมินครู


## 9) Evaluations – แบบประเมินครู

### POST /api/evaluations/import
- multipart/form-data (ฟิลด์ไฟล์ `file`/`excel`/`upload`/`sheet` – ต้องเป็น `.xlsx`/`.xls`)
- แนบ `teacherId` ได้เพื่อผูกกับครูในระบบ
- Response 201: `{ "message": "นำเข้าข้อมูลแบบประเมินสำเร็จ", "sheet": { id, subject, teacherName, evaluatorName, evaluatedAt, answers: [...] } }`

### GET /api/evaluations
- Query: `page`, `pageSize`, `teacherId`, `subject`, `teacherName`, `evaluatorName`, `search`
- Response: รายการ + จำนวนหน้ารวม

### GET /api/evaluations/:id
- คืนแบบประเมินเดี่ยวพร้อมคำตอบและข้อมูลครู (ถ้ามี)

### PUT /api/evaluations/:id
- Auth: ผู้ใช้ที่ล็อกอิน (แนะนำ ADMIN)
- ใช้แก้ไขข้อมูลหัวกระดาษ เช่น `subject`, `teacherName`, `teacherId`, `evaluatorName`, `evaluatedAt`, `notes`
- หากส่ง `answers` (array) จะลบและสร้างรายการคำตอบใหม่ตามข้อมูลที่ส่งมา

```http
PUT /api/evaluations/91
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "การสอนยุทธวิธีกองร้อย",
  "teacherName": "น.ต. เอกชัย สถิตย์",
  "evaluatorName": "แผนกตรวจการ",
  "evaluatedAt": "2025-11-20",
  "notes": "แก้ไขคะแนนรอบทบทวน",
  "answers": [
    { "section": "ด้านการสอน", "itemCode": "1", "itemText": "ความพร้อมของครู", "rating": 4 },
    { "section": "ด้านการสอน", "itemCode": "2", "itemText": "ความเข้าใจบทเรียน", "rating": 5 }
  ]
}
```

**Response 200** → `{ "data": { ... } }`

### DELETE /api/evaluations/:id
- Auth: ผู้ใช้ที่ล็อกอิน (แนะนำ ADMIN)
- ลบแบบประเมินและคำตอบทั้งหมด
- Response: `{ "message": "ลบแบบประเมินสำเร็จ" }`


### GET /api/evaluations/template/download
- คืนไฟล์ Excel เทมเพลต (สามารถใช้ `curl -OJ https://<host>/api/evaluations/template/download -H "Authorization: Bearer <token>"`)

---

## 10) Student Evaluation – แบบประเมินกองร้อย

### POST /api/admin/student-evaluation-templates
- Auth: ADMIN
- ใช้สร้าง template สำหรับประเมิน (ระบุชื่อ, คำอธิบาย, รายการหมวด + คำถาม)
- ต้องส่ง `templateType` ชัดเจน: `BATTALION` = ประเมินกองพัน, `COMPANY` = ประเมินกองร้อย (ไม่มีค่าเริ่มต้น)
- ถ้า `templateType = BATTALION` ต้องส่ง `battalionCount` (จำนวนกองพันที่ต้องการประเมิน) และ `teacherEvaluatorCount` (จำนวนครูผู้ประเมิน) เป็นจำนวนเต็ม > 0

```http
POST /api/admin/student-evaluation-templates
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "แบบประเมินกองร้อยประจำเดือน",
  "description": "ใช้ทุกกองพัน",
  "templateType": "COMPANY",
  "battalionCount": 4,
  "teacherEvaluatorCount": 2,
  "sections": [
    {
      "title": "หมวดวินัย (Discipline)",
      "sectionOrder": 1,
      "questions": [
        { "prompt": "มาตรงเวลาและเข้าร่วมกิจกรรมครบ", "maxScore": 5 },
        { "prompt": "ปฏิบัติตามคำสั่งผู้บังคับบัญชา", "maxScore": 5 }
      ]
    },
    {
      "title": "หมวดความร่วมมือ (Teamwork)",
      "sectionOrder": 2,
      "questions": [
        { "prompt": "ทำงานร่วมกับเพื่อนได้ดี", "maxScore": 5 },
        { "prompt": "รับฟังความคิดเห็นผู้อื่น", "maxScore": 5 }
      ]
    }
  ]
}
```

**201** → `{ "template": { id, name, sections[…questions…] } }`

### GET /api/admin/student-evaluation-templates
- Auth: ADMIN
- Query: `includeInactive` (ค่าเริ่มต้น false), `search`
- แต่ละ template จะคืน `templateType` (BATTALION/COMPANY) เพื่อบ่งบอกประเภทฟอร์มประเมิน
- คืน template ทั้งหมดพร้อม sections/questions

### GET /api/admin/student-evaluation-templates/:id
- Auth: ADMIN
- คืน template ตาม id

### PUT /api/admin/student-evaluation-templates/:id
- Auth: ADMIN
- ใช้แก้ไขชื่อ/คำอธิบาย หรือแทนที่ sections ใหม่ (ส่ง `sections` เป็น array เต็มชุด)

### DELETE /api/admin/student-evaluation-templates/:id
- Auth: ADMIN
- ลบ template

---

### POST /api/student-evaluations
- Auth: ADMIN หรือ TEACHER
- ใช้บันทึกผลการประเมินระดับ “กองร้อย/กองพัน” ตาม template
- ฟิลด์สำคัญ: `templateId`, `subject` (วิชาที่เรียน), `companyCode`, `battalionCode`, `evaluationPeriod`, `summary`, `overallScore`, `answers[]` (questionId + score + comment ได้)

```http
POST /api/student-evaluations
Authorization: Bearer <admin_or_teacher_token>
Content-Type: application/json

{
  "templateId": 1,
  "subject": "การใช้อาวุธประจำกาย",
  "companyCode": "ร้อย.1",
  "battalionCode": "พัน.ฝึก5",
  "evaluationPeriod": "2025-11-30",
  "summary": "ควบคุมวินัยดี แต่ต้องเพิ่มความพร้อมทางร่างกาย",
  "overallScore": 86,
  "answers": [
    { "questionId": 10, "score": 5 },
    { "questionId": 11, "score": 4, "comment": "ควรฝึกเพิ่ม" }
  ]
}
```

**201** → `{ "evaluation": { id, companyCode, battalionCode, template, answers… } }`

### GET /api/student-evaluations
- Auth: ADMIN หรือ TEACHER
- Query: `templateId`, `companyCode`, `battalionCode`, `evaluatorId`
- ใช้กรองผลตาม template/กองร้อย/กองพัน หรือ evaluator

### GET /api/student-evaluations/comparison
- Auth: ADMIN หรือ TEACHER
- Query: `templateId`, `companyCode`, `battalionCode`, `evaluatorId`, `templateType` (ยกเว้น `SERVICE`)
- Response สำหรับสร้างกราฟเปรียบเทียบคะแนนเฉลี่ย:  
`{ "comparison": { "battalions": [{ "battalionCode": "...", "averageOverallScore": 4.25, "totalEvaluations": 6, "totalScore": 25.5, "companies": [{ "companyCode": "...", "averageOverallScore": 4.3 }] }], "companies": [...] } }`
- ลำดับเรียงจากคะแนนเฉลี่ยมาก → น้อย
- ถ้าต้องการให้รายการเติมครบทุกกองพัน/กองร้อย (แม้ยังไม่มีผล) ให้ส่ง `battalionCodes` และ `companyCodes` คั่น comma เช่น `?battalionCodes=พัน1,พัน2,พัน3,พัน4&companyCodes=ร้อย1,ร้อย2,ร้อย3,ร้อย4,ร้อย5`

### GET /api/student-evaluations/:id
- Auth: ADMIN หรือ TEACHER
- คืนรายละเอียดผลการประเมินพร้อมคำตอบทุกข้อ

### PUT /api/student-evaluations/:id
- Auth: ADMIN หรือ TEACHER
- ปรับ `summary`, `overallScore`, `subject`, `companyCode`, `battalionCode`, `evaluationPeriod`
- หากส่ง `answers` ใหม่ จะลบของเดิมแล้วเขียนทับ

### DELETE /api/student-evaluations/:id
- Auth: ADMIN หรือ TEACHER
- ลบผลการประเมิน

---

## 11) Static Files

### GET /uploads/avatars/:filename
- ไม่ต้องพิสูจน์ตัวตน
- ไฟล์ภาพ cache ได้นาน (ตั้งค่า `Cache-Control` ไว้แล้ว)

---

## เช็กลิสต์การใช้งาน
1. สมัครหรือให้ ADMIN สร้างผู้ใช้เพื่อรับ username/password
2. เรียก `/login` แล้วเก็บ `accessToken` + `refreshToken`
3. แนบ `Authorization: Bearer <accessToken>` กับทุกคำขอที่ต้องพิสูจน์สิทธิ์
4. เมื่อ access token หมดอายุ (401) ให้เรียก `/refresh-token`
5. ใช้ endpoint ตามบทบาท: ADMIN (จัดการผู้ใช้/แดชบอร์ด/คำขอลา), TEACHER (รายงาน/ลา), OWNER (อนุมัติขั้นสุดท้าย/ลาไปราชการ)

หากเจอปัญหาให้ดูข้อความ `message`/`detail` หรือเช็ก log ฝั่งเซิร์ฟเวอร์เพิ่มเติม
