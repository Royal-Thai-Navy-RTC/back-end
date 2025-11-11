# API Documentation

## API Routes

### POST `/api/register`

**Access:** Public
**คำอธิบาย:** ลงทะเบียนผู้ใช้ใหม่ โดยต้องส่งข้อมูลตามโครงสร้างที่ระบบกำหนด

---

### POST `/api/login`

**Access:** Public
**คำอธิบาย:** เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน ระบบจะส่ง JWT token กลับมา

---

### GET `/api/me`

**Access:** Auth required
**คำอธิบาย:** ดึงข้อมูลโปรไฟล์ของผู้ใช้ที่เข้าสู่ระบบอยู่

---

### PUT `/api/me`

**Access:** Auth required
**คำอธิบาย:** แก้ไขข้อมูลโปรไฟล์ของตนเอง (เฉพาะฟิลด์ที่อนุญาตให้แก้ไขได้อย่างปลอดภัย)

---

### GET `/api/admin/users`

**Access:** Admin only
**คำอธิบาย:** แสดงรายชื่อผู้ใช้ทั้งหมด โดยสามารถระบุหน้า ขนาดต่อหน้า และคำค้นหาได้

---

### GET `/api/admin/users/:id`

**Access:** Admin only
**คำอธิบาย:** ดึงข้อมูลรายละเอียดของผู้ใช้ตาม ID

---

### PUT `/api/admin/users/:id`

**Access:** Admin only
**คำอธิบาย:** แก้ไขข้อมูลผู้ใช้ตาม ID สามารถเปลี่ยนบทบาท ยศ สถานะการใช้งาน และรีเซ็ตรหัสผ่านได้

---

## Example Header

```
Authorization: <token>
```
