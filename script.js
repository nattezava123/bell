import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDi_YY7DbZoKWo42LDFxe2NYJs8jeIc21E",
  authDomain: "hr-workspace-b261f.firebaseapp.com",
  projectId: "hr-workspace-b261f",
  storageBucket: "hr-workspace-b261f.firebasestorage.app",
  messagingSenderId: "363256251297",
  appId: "1:363256251297:web:ec2edb8c0435be516141e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🌟 ป้องกัน Session Storage พัง
let currentUser = null;
try {
    const stored = sessionStorage.getItem('hr_currentUser');
    if (stored) currentUser = JSON.parse(stored);
} catch (e) {
    sessionStorage.removeItem('hr_currentUser');
    console.error("Session Storage Error:", e);
}

const leaveTypesTH = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน', compensatory: 'วันหยุดชดเชย', maternity: 'ลาคลอด', ordination: 'ลาบวช', military: 'ลาเกณฑ์ทหาร', other: 'อื่นๆ' };

window.allTimeRecords = [];
window.allLeaves = []; 
window.allUsers = []; 
window.currentTimePage = 1;
window.rowsPerPage = 10;

// ==========================================
// 🌟 1. ฟังก์ชันคำนวณเวลาแบบมาตรฐาน HR (ปัดเศษ 30 นาที)
// ==========================================
window.calculateHRWorkHours = (timeInStr, timeOutStr) => {
    if (!timeInStr || !timeOutStr || timeInStr === '-' || timeOutStr === '-') {
        return { normal: 0, ot: 0 };
    }
    
    try {
        const [inH, inM] = timeInStr.split(':').map(Number);
        const [outH, outM] = timeOutStr.split(':').map(Number);
        
        let inMins = (inH * 60) + inM;
        let outMins = (outH * 60) + outM;
        
        let roundedIn = Math.ceil(inMins / 30) * 30;
        let roundedOut = Math.floor(outMins / 30) * 30;
        
        if (roundedOut < roundedIn) roundedOut = roundedIn;
        
        let diffMins = roundedOut - roundedIn;
        
        if (roundedIn <= 720 && roundedOut >= 780) {
            diffMins -= 60;
        }
        
        let totalHrs = Math.max(0, diffMins / 60);
        let normalHrs = Math.min(8, totalHrs);
        let otHrs = Math.max(0, totalHrs - 8);
        
        return { normal: normalHrs, ot: otHrs };
    } catch (e) {
        return { normal: 0, ot: 0 };
    }
};

// ==========================================
// 🌟 ฟังก์ชันจัดการวันที่
// ==========================================
window.formatDateShort = (dateStr, fallbackTimestamp = null, fallbackDateStr = null) => {
    try {
        let d = null;
        if (dateStr && dateStr !== '-' && dateStr !== 'Invalid Date' && typeof dateStr === 'string' && dateStr.includes('-')) {
            const p = dateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if ((!d || isNaN(d.getTime())) && fallbackTimestamp) { d = new Date(fallbackTimestamp); }
        if ((!d || isNaN(d.getTime())) && fallbackDateStr && typeof fallbackDateStr === 'string' && fallbackDateStr.includes('-')) {
            const p = fallbackDateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if (!d || isNaN(d.getTime())) d = new Date(); 
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return '-'; }
};

window.formatDateFull = (dateStr, fallbackTimestamp = null, fallbackDateStr = null) => {
    try {
        let d = null;
        if (dateStr && dateStr !== '-' && dateStr !== 'Invalid Date' && typeof dateStr === 'string' && dateStr.includes('-')) {
            const p = dateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if ((!d || isNaN(d.getTime())) && fallbackTimestamp) { d = new Date(fallbackTimestamp); }
        if ((!d || isNaN(d.getTime())) && fallbackDateStr && typeof fallbackDateStr === 'string' && fallbackDateStr.includes('-')) {
            const p = fallbackDateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if (!d || isNaN(d.getTime())) d = new Date(); 
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return '-'; }
};

window.formatDateCSV = (dateStr, fallbackTimestamp = null, fallbackDateStr = null) => {
    try {
        let d = null;
        if (dateStr && dateStr !== '-' && dateStr !== 'Invalid Date' && typeof dateStr === 'string' && dateStr.includes('-')) {
            const p = dateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if ((!d || isNaN(d.getTime())) && fallbackTimestamp) { d = new Date(fallbackTimestamp); }
        if ((!d || isNaN(d.getTime())) && fallbackDateStr && typeof fallbackDateStr === 'string' && fallbackDateStr.includes('-')) {
            const p = fallbackDateStr.split('-');
            if (p.length >= 3) d = new Date(p[0], parseInt(p[1]) - 1, parseInt(p[2]));
        }
        if (!d || isNaN(d.getTime())) d = new Date(); 
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) { return '-'; }
};

const getSafeTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ==========================================
// UI Helpers
// ==========================================
window.showSwal = (title, text, icon = 'success') => {
    if (typeof Swal !== 'undefined') { 
        Swal.fire({ title, text, icon, confirmButtonText: 'ตกลง', confirmButtonColor: '#2563eb', timer: icon === 'success' ? 2500 : undefined, customClass: { popup: 'rounded-4' } });
    } else { alert(`${title}\n${text}`); }
};

window.navigate = (sectionId) => {
    document.querySelectorAll('.spa-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');
};

const getStatusBadge = (status) => {
    const badges = { 'อนุมัติ': '<span class="badge bg-success-subtle text-success">อนุมัติ</span>', 'ไม่อนุมัติ': '<span class="badge bg-danger-subtle text-danger">ไม่อนุมัติ</span>', 'ยกเลิก': '<span class="badge bg-secondary-subtle text-secondary">ยกเลิกแล้ว</span>', 'ขอยกเลิก': '<span class="badge bg-warning-subtle text-warning">รออนุมัติยกเลิก</span>' };
    return badges[status] || '<span class="badge bg-primary-subtle text-primary">รอพิจารณา</span>';
};

const getRoleBadge = (role) => {
    const badges = { 'admin': '<span class="badge bg-dark-subtle text-dark">Admin</span>', 'leader': '<span class="badge bg-primary-subtle text-primary">Manager</span>' };
    return badges[role] || '<span class="badge bg-info-subtle text-info">Employee</span>';
};

window.filterTable = (inputId, tbodyId) => {
    const input = document.getElementById(inputId);
    const tbody = document.getElementById(tbodyId);
    if (!input || !tbody) return;
    const filter = input.value.toLowerCase();
    const rows = tbody.getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].innerText.toLowerCase();
        rows[i].style.display = rowText.includes(filter) ? '' : 'none';
    }
};

window.checkAuthStatus = (reqRole) => {
    if (!currentUser && reqRole !== 'login') { window.location.replace('index.html'); return false; }
    if (currentUser && reqRole === 'login') { 
        let targetPage = 'employee.html';
        if (currentUser.role === 'leader') targetPage = 'manager.html';
        if (currentUser.role === 'admin') targetPage = 'admin.html';
        window.location.replace(targetPage); 
        return false; 
    }
    if (currentUser && document.getElementById('navUserInfo')) { 
        document.getElementById('navUserInfo').innerText = `${currentUser.Name} ${currentUser.SurName || ''} (${currentUser.role.toUpperCase()})`; 
    }
    return true;
};

// ==========================================
// 🌟 ระบบ Login / Logout
// ==========================================
window.handleLogin = async (e) => {
    if(e) e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังตรวจสอบ...'; }
    
    const userInp = document.getElementById('loginUsername').value.trim();
    const passInp = document.getElementById('loginPassword').value.trim();
    
    if (!userInp || !passInp) {
        window.showSwal('ข้อมูลไม่ครบ', 'กรุณากรอกรหัสพนักงานและรหัสผ่าน', 'warning');
        if (btn) { btn.disabled = false; btn.innerHTML = 'เข้าสู่ระบบ <i class="bi bi-box-arrow-in-right ms-1"></i>'; }
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", userInp));
        if (userDoc.exists() && userDoc.data().password === passInp) {
            const userData = userDoc.data();
            userData.uid = userData.uid || userDoc.id; 
            sessionStorage.setItem('hr_currentUser', JSON.stringify(userData));
            
            let targetPage = 'employee.html';
            if (userData.role === 'leader') targetPage = 'manager.html';
            if (userData.role === 'admin') targetPage = 'admin.html';
            
            window.location.replace(targetPage);
        } else { 
            window.showSwal('เข้าสู่ระบบไม่สำเร็จ', 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error'); 
            if (btn) { btn.disabled = false; btn.innerHTML = 'เข้าสู่ระบบ <i class="bi bi-box-arrow-in-right ms-1"></i>'; }
        }
    } catch (error) { 
        window.showSwal('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); 
        if (btn) { btn.disabled = false; btn.innerHTML = 'เข้าสู่ระบบ <i class="bi bi-box-arrow-in-right ms-1"></i>'; }
    }
};

const loginForm = document.getElementById('loginForm');
if (loginForm) loginForm.addEventListener('submit', window.handleLogin);

window.logout = (e) => {
    if(e) e.preventDefault();
    const executeLogout = () => { sessionStorage.clear(); currentUser = null; window.location.replace('index.html'); };
    if (typeof Swal !== 'undefined') {
        Swal.fire({ title: 'ออกจากระบบ?', text: 'คุณต้องการออกจากระบบใช่หรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก', reverseButtons: true })
        .then((result) => { if (result.isConfirmed) executeLogout(); });
    } else {
        if(confirm('ต้องการออกจากระบบหรือไม่?')) executeLogout();
    }
};

// ==========================================
// ส่วนแนบไฟล์ต่างๆ
// ==========================================
window.previewCertImage = (leaveId) => {
    const l = window.allLeaves.find(x => x.id === leaveId);
    if (!l || !l.certUrl) return window.showSwal('ไม่พบไฟล์', 'ไม่มีไฟล์เอกสารแนบในรายการนี้', 'warning');
    const base64Data = l.certUrl;

    if (base64Data.startsWith('data:application/pdf')) {
        Swal.fire({ title: 'เอกสาร PDF', html: `<iframe src="${base64Data}" width="100%" height="400px" style="border: none; border-radius: 8px;"></iframe>`, width: '800px', showCloseButton: true, showConfirmButton: false, customClass: { popup: 'rounded-4' } });
        return;
    }

    Swal.fire({ title: `ใบรับรองแพทย์ / เอกสารอ้างอิง`, imageUrl: base64Data, imageAlt: 'เอกสารแนบ', customClass: { image: 'img-fluid rounded border shadow-sm my-3', popup: 'rounded-4' }, imageMaxHeight: 450, showConfirmButton: true, confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#2563eb', showCancelButton: true, cancelButtonText: '<i class="bi bi-download me-1"></i> ดาวน์โหลดรูป', cancelButtonColor: '#10b981' })
    .then((result) => { if (result.dismiss === Swal.DismissReason.cancel) { const a = document.createElement('a'); a.href = base64Data; a.download = `Medical_Cert_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); } });
};

const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000; const MAX_HEIGHT = 1000;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = error => reject(error);
    });
};

const getBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

window.handleStampTime = async () => {
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    if(!loc || !det.trim()) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุสถานที่และรายละเอียดงาน', 'warning');

    const now = new Date();
    const todayStr = getSafeTodayString();
    const currentTime = now.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    const recordsRef = collection(db, "workRecords");
    const q = query(recordsRef, where("empID", "==", currentUser.uid), where("workDate", "==", todayStr));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        Swal.fire({ title: 'ยืนยัน CHECK-IN?', html: `คุณกำลังจะเข้างานเวลา <b>${currentTime} น.</b><br>สถานที่: <span class="text-primary fw-medium">${loc}</span>`, icon: 'question', showCancelButton: true, confirmButtonColor: '#2563eb', confirmButtonText: 'บันทึกเข้างาน', cancelButtonText: 'ยกเลิก' }).then(async (result) => {
            if (result.isConfirmed) {
                const btn = document.getElementById('btnStampTime');
                if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...'; }
                try {
                    await addDoc(recordsRef, { empID: currentUser.uid, timestamp: now.getTime(), workDate: todayStr, timeIn: currentTime, timeOut: "", workHours: 0.0, otHours: 0.0, details: det, location: loc, status: "Working" });
                    Swal.fire({ title: 'CHECK-IN สำเร็จ', text: `เข้างานเวลา: ${currentTime} น.`, icon: 'success', timer: 2000, showConfirmButton: false });
                    await refreshUI();
                    window.navigate('sectionTimeHistory'); window.scrollTo(0, 0);
                } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกเวลาได้', 'error'); if(btn) { btn.disabled = false; btn.innerHTML = 'แสตมป์เวลา'; } }
            }
        });
    } else {
        const recordDoc = snapshot.docs[0];
        const recordData = recordDoc.data();
        if (recordData.timeOut) return window.showSwal('แจ้งเตือน', 'คุณได้บันทึกเวลาออกงานของวันนี้ไปแล้ว', 'warning');

        Swal.fire({ title: 'ยืนยัน CHECK-OUT?', html: `คุณกำลังจะออกงานเวลา <b>${currentTime} น.</b>`, icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'บันทึกออกงาน', cancelButtonText: 'ยกเลิก' }).then(async (result) => { 
            if (result.isConfirmed) {
                const btn = document.getElementById('btnStampTime');
                if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...'; }
                try {
                    const hrCalc = window.calculateHRWorkHours(recordData.timeIn, currentTime);
                    await updateDoc(doc(db, "workRecords", recordDoc.id), { timeOut: currentTime, workHours: parseFloat(hrCalc.normal.toFixed(1)), otHours: parseFloat(hrCalc.ot.toFixed(1)), details: det, location: loc, status: "Completed" });
                    Swal.fire({ title: 'บันทึกเวลาสำเร็จ', html: `เวลาทำงาน: <b>${hrCalc.normal.toFixed(1)}</b> ชม.<br>OT: <b>${hrCalc.ot.toFixed(1)}</b> ชม.`, icon: 'success', timer: 3000, showConfirmButton: false, allowOutsideClick: false });
                    await refreshUI();
                    window.navigate('sectionTimeHistory'); window.scrollTo(0, 0);
                } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกเวลาได้', 'error'); if(btn) { btn.disabled = false; btn.innerHTML = 'แสตมป์เวลา'; } }
            }
        });
    }
};

window.saveDailyDetails = async (e) => {
    e.preventDefault();
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    const todayStr = getSafeTodayString();
    const q = query(collection(db, "workRecords"), where("empID", "==", currentUser.uid), where("workDate", "==", todayStr));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) { await updateDoc(doc(db, "workRecords", snapshot.docs[0].id), { location: loc, details: det }); window.showSwal('บันทึกสำเร็จ', 'อัปเดตรายละเอียดงานเรียบร้อย', 'success'); } 
    else { window.showSwal('ข้อผิดพลาด', 'กรุณา CHECK-IN ก่อนบันทึกรายละเอียด', 'error'); }
};

window.handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const typeOther = document.getElementById('leaveTypeOther') ? document.getElementById('leaveTypeOther').value : '';
    const leaveTime = document.getElementById('leaveTime') ? document.getElementById('leaveTime').value : 'เต็มวัน';
    
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value || startDate;
    const reason = document.getElementById('leaveReason').value;
    const fileInput = document.getElementById('leaveCertFile');
    
    if(!type || !startDate) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุประเภทและวันที่', 'warning');
    if(type === 'other' && !typeOther.trim()) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุประเภทการลาอื่นๆ', 'warning');

    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    if(days <= 0) return window.showSwal('ข้อผิดพลาด', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น', 'error');
    
    if(type !== 'other' && currentUser.leaveBalances && currentUser.leaveBalances[type] !== undefined && currentUser.leaveBalances[type] < days) { 
        return window.showSwal('สิทธิหมด', `สิทธิคงเหลือไม่พอสำหรับการลา ${days} วัน`, 'error'); 
    }

    let fileUrl = "";
    let hasCert = false;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        window.showSwal('กำลังประมวลผล', 'ระบบกำลังเตรียมไฟล์เอกสาร กรุณารอสักครู่...', 'info');
        try {
            if (file.type.startsWith('image/')) { fileUrl = await compressImage(file);
            } else if (file.type === 'application/pdf') {
                if (file.size > 500 * 1024) return window.showSwal('ไฟล์ใหญ่เกินไป', 'ไฟล์ PDF ต้องมีขนาดไม่เกิน 500KB', 'warning');
                fileUrl = await getBase64(file);
            }
            hasCert = true;
        } catch (error) { return window.showSwal('ข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่อีกครั้ง', 'error'); }
    }

    const todayStr = getSafeTodayString();
    try {
        await addDoc(collection(db, "leaves"), { 
            empID: currentUser.uid, type, typeOther, leaveTime, submittedDate: todayStr, startDate, endDate, days, reason, hasCert, certUrl: fileUrl, status: 'รอพิจารณา', timestamp: new Date().getTime() 
        });
        
        e.target.reset(); 
        if(typeof window.toggleOtherLeaveType === 'function') window.toggleOtherLeaveType('');
        
        window.showSwal('ยื่นคำขอสำเร็จ', 'ระบบได้รับคำขออนุมัติเรียบร้อยแล้ว', 'success'); 
        await refreshUI();
        const historyTabBtn = document.getElementById('tab-leave-history-btn'); 
        if(historyTabBtn) { const tab = new bootstrap.Tab(historyTabBtn); tab.show(); }
    } catch (err) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ (ไฟล์อาจใหญ่เกินไป)', 'error'); }
};

window.cancelMyLeave = (leaveId) => {
    Swal.fire({ title: 'ยกเลิกคำขอ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ยกเลิกคำขอ' }).then(async (result) => {
        if (result.isConfirmed) { await updateDoc(doc(db, "leaves", leaveId), { status: 'ยกเลิก' }); window.showSwal('ยกเลิกสำเร็จ', '', 'success'); refreshUI(); }
    });
};

window.requestCancelLeave = (leaveId) => {
    Swal.fire({ title: 'ต้องการขอยกเลิกการลา?', text: 'ต้องรอหัวหน้างานอนุมัติเพื่อคืนสิทธิ์วันลา', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f59e0b', confirmButtonText: 'ส่งคำขอยกเลิก' }).then(async (result) => {
        if (result.isConfirmed) { await updateDoc(doc(db, "leaves", leaveId), { status: 'ขอยกเลิก' }); window.showSwal('ส่งคำขอสำเร็จ', 'รอหัวหน้างานอนุมัติยกเลิก', 'success'); refreshUI(); }
    });
};

window.updateLeaveStatus = async (leaveId, newStatus, empID, type, days = 1, currentStatus = 'รอพิจารณา') => {
    await updateDoc(doc(db, "leaves", leaveId), { status: newStatus });
    const userDocRef = doc(db, "users", empID);
    const userSnap = await getDoc(userDocRef);
    if(userSnap.exists()) {
        const userData = userSnap.data();
        if (type !== 'other' && userData.leaveBalances && userData.leaveBalances[type] !== undefined) {
            if(newStatus === 'อนุมัติ' && currentStatus === 'รอพิจารณา') { userData.leaveBalances[type] -= days; } 
            else if(newStatus === 'ยกเลิก' && currentStatus === 'ขอยกเลิก') { userData.leaveBalances[type] += days; }
            await updateDoc(userDocRef, { leaveBalances: userData.leaveBalances });
        }
    }
    const ocEl = document.getElementById('leaveDetailOffcanvas');
    if(ocEl) { const oc = bootstrap.Offcanvas.getInstance(ocEl); if(oc) oc.hide(); }
    window.showSwal('บันทึกสำเร็จ', `ปรับสถานะเป็น "${newStatus}" แล้ว`, newStatus.includes('อนุมัติ') || newStatus === 'ยกเลิก' ? 'success' : 'info'); 
    refreshUI();
};

window.viewLeaveDetail = async (leaveId) => {
    try {
        const l = window.allLeaves.find(x => x.id === leaveId);
        if(!l) return;
        const uDoc = await getDoc(doc(db, "users", l.empID)); const u = uDoc.data();
        
        const displaySubmit = window.formatDateFull(l.submittedDate, l.timestamp, l.startDate || l.date);
        const displayStart = window.formatDateFull(l.startDate || l.date);
        const displayEnd = (l.endDate && l.endDate !== (l.startDate || l.date)) ? ` ถึง ${window.formatDateFull(l.endDate)}` : '';
        const displayType = l.type === 'other' ? `ลาอื่นๆ (${l.typeOther || '-'})` : leaveTypesTH[l.type];
        const displayTime = l.leaveTime || 'เต็มวัน';
        
        const certHtml = l.certUrl 
            ? `<button type="button" class="btn btn-sm btn-outline-primary fw-bold w-100 py-2 rounded-3" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-image me-1"></i>ดูรูปใบรับรองแพทย์/เอกสาร</button>` 
            : (l.hasCert ? '<span class="badge bg-success-subtle text-success">มีเอกสารแนบ</span>' : '<span class="badge bg-secondary-subtle text-secondary">ไม่มีเอกสารแนบ</span>');
        
        let actionButtons = '';
        const isOwnLeave = l.empID === currentUser.uid;
        const canApprove = !isOwnLeave && ((currentUser.role === 'admin' && u.role === 'leader') || (currentUser.role === 'leader' && u.role === 'employee'));
        const lDays = l.days || 1;

        if (canApprove) {
            if (l.status === 'รอพิจารณา') {
                actionButtons = `<div class="d-flex gap-2 mt-4 border-top pt-4"><button class="btn btn-primary w-50 py-2 fw-bold rounded-pill shadow-sm" onclick="window.updateLeaveStatus('${l.id}', 'อนุมัติ', '${l.empID}', '${l.type}', ${lDays}, 'รอพิจารณา')"><i class="bi bi-check-circle me-1"></i> อนุมัติ</button><button class="btn btn-outline-danger w-50 py-2 fw-bold rounded-pill shadow-sm" onclick="window.updateLeaveStatus('${l.id}', 'ไม่อนุมัติ', '${l.empID}', '${l.type}', 0, 'รอพิจารณา')"><i class="bi bi-x-circle me-1"></i> ไม่อนุมัติ</button></div>`;
            } else if (l.status === 'ขอยกเลิก') {
                actionButtons = `<div class="d-flex gap-2 mt-4 border-top pt-4"><button class="btn btn-danger w-50 py-2 fw-bold rounded-pill shadow-sm" onclick="window.updateLeaveStatus('${l.id}', 'ยกเลิก', '${l.empID}', '${l.type}', ${lDays}, 'ขอยกเลิก')"><i class="bi bi-check-circle me-1"></i> อนุมัติยกเลิก</button><button class="btn btn-outline-secondary w-50 py-2 fw-bold rounded-pill shadow-sm" onclick="window.updateLeaveStatus('${l.id}', 'อนุมัติ', '${l.empID}', '${l.type}', 0, 'ขอยกเลิก')"><i class="bi bi-x-circle me-1"></i> ปฏิเสธการยกเลิก</button></div>`;
            }
        }

        const content = `
            <div class="mb-4 text-center border-bottom pb-3">
                <div class="mb-2"><span class="fs-1 text-primary">📄</span></div>
                <h5 class="fw-bold mb-1 text-dark">${u.Name} ${u.SurName || ''}</h5>
                <small class="text-muted">รหัสพนักงาน: ${u.uid || l.empID}</small>
            </div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">สถานะคำขอ</label><div>${getStatusBadge(l.status)}</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">ประเภทการลา</label><div class="fw-bold text-primary fs-6">${displayType} (${l.days || 1} วัน)</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">วันที่ยื่นเรื่อง</label><div class="text-dark">${displaySubmit}</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">วันที่ลา</label><div class="text-dark fw-medium">${displayStart}${displayEnd} <span class="text-primary ms-2">(${displayTime})</span></div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">เอกสารแนบประกอบ</label><div>${certHtml}</div></div>
            <div class="mb-4"><label class="small text-muted d-block mb-1 fw-bold">เหตุผลการลา</label><div class="p-3 bg-light rounded-3 text-dark border">${l.reason}</div></div>
            ${actionButtons}
            <button class="btn btn-secondary w-100 fw-bold mt-2 rounded-pill py-2" data-bs-dismiss="offcanvas">ปิดหน้าต่าง</button>
        `;

        const drawerEl = document.getElementById('leaveDetailOffcanvas');
        if (drawerEl) {
            document.getElementById('leaveDetailOffcanvasBody').innerHTML = content;
            const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(drawerEl);
            bsOffcanvas.show();
        } else {
            Swal.fire({ title: 'รายละเอียดการลา', html: content, confirmButtonText: 'ปิดหน้าต่าง' });
        }
    } catch (e) { console.error(e); }
};

window.handleAddEmployee = async (e) => {
    e.preventDefault();
    const newId = document.getElementById('regId').value;
    const idCard = document.getElementById('regIdCard').value;
    const docSnap = await getDoc(doc(db, "users", newId));
    if(docSnap.exists()) return window.showSwal('ผิดพลาด', 'รหัสพนักงานซ้ำ', 'error');
    const autoPassword = idCard.slice(-4); 
    const initialQuota = { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
    await setDoc(doc(db, "users", newId), { 
        uid: newId, idCard: idCard, password: autoPassword, Name: document.getElementById('regName').value, SurName: '', role: document.getElementById('regRole').value, 
        leaveBalances: initialQuota, leaveTotal: initialQuota 
    });
    document.getElementById('addEmployeeForm').reset(); window.showSwal('สำเร็จ!', `สร้างบัญชีเรียบร้อย\nรหัสผ่านคือ: ${autoPassword}`, 'success'); refreshUI();
};

window.deleteEmployee = (id) => { 
    if(id === 'admin') return window.showSwal('ปฏิเสธ', 'ไม่สามารถลบ Admin ได้', 'error'); 
    Swal.fire({ title: 'ยืนยันการลบ?', text: 'ข้อมูลจะถูกลบถาวร', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ลบข้อมูล' }).then(async (result) => { if(result.isConfirmed) { await deleteDoc(doc(db, "users", id)); refreshUI(); } });
};

window.currentEditEmpId = null;
window.openEditEmployeeModal = async (uid) => {
    try {
        if (!uid || uid === 'undefined') return window.showSwal('ข้อผิดพลาด', 'รหัสพนักงานไม่ถูกต้อง', 'error');
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const u = userDoc.data();
            window.currentEditEmpId = uid;
            document.getElementById('editEmpIdDisplay').value = u.uid || uid; document.getElementById('editEmpIdCardInput').value = u.idCard || ''; document.getElementById('editEmpNameInput').value = `${u.Name || ''} ${u.SurName || ''}`.trim(); document.getElementById('editEmpRoleInput').value = u.role || 'employee';
            bootstrap.Modal.getOrCreateInstance(document.getElementById('editEmpModal')).show();
        }
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถเข้าถึงข้อมูลได้', 'error'); }
};

window.saveEditEmployee = async () => {
    const uid = window.currentEditEmpId;
    if (!uid) return;
    const newIdCard = document.getElementById('editEmpIdCardInput').value.trim(); const fullName = document.getElementById('editEmpNameInput').value.trim(); const newRole = document.getElementById('editEmpRoleInput').value;
    if (!fullName) return window.showSwal('ข้อผิดพลาด', 'กรุณาระบุชื่อพนักงาน', 'warning');
    const nameParts = fullName.split(' '); const newName = nameParts[0]; const newSurName = nameParts.slice(1).join(' ');
    const btn = document.getElementById('btnSaveEdit'); if(btn) { btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...'; }
    try {
        const userDoc = await getDoc(doc(db, "users", uid)); const u = userDoc.data();
        await updateDoc(doc(db, "users", uid), { idCard: newIdCard, password: newIdCard ? newIdCard.slice(-4) : u.password, Name: newName, SurName: newSurName, role: newRole });
        bootstrap.Modal.getInstance(document.getElementById('editEmpModal')).hide(); window.showSwal('สำเร็จ', 'อัปเดตข้อมูลพนักงานเรียบร้อย', 'success'); refreshUI();
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'บันทึกข้อมูลไม่สำเร็จ', 'error'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = 'บันทึกการเปลี่ยนแปลง'; } }
};

window.currentEditLeaveBalId = null;
window.openEditLeaveBalanceModal = async (uid) => {
    try {
        if (!uid || uid === 'undefined') return window.showSwal('ข้อผิดพลาด', 'รหัสพนักงานไม่ถูกต้อง', 'error');
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const u = userDoc.data();
            window.currentEditLeaveBalId = uid;
            document.getElementById('leaveBalEmpName').innerText = `${u.uid || uid} : ${u.Name || ''} ${u.SurName || ''}`;
            const total = u.leaveTotal || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
            document.getElementById('editBalSick').value = total.sick || 0; document.getElementById('editBalPers').value = total.personal || 0; document.getElementById('editBalAnn').value = total.annual || 0; document.getElementById('editBalComp').value = total.compensatory || 0; document.getElementById('editBalMat').value = total.maternity || 0; document.getElementById('editBalOrd').value = total.ordination || 0; document.getElementById('editBalMil').value = total.military || 0;
            bootstrap.Modal.getOrCreateInstance(document.getElementById('editLeaveBalanceModal')).show();
        }
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถเข้าถึงข้อมูลได้', 'error'); }
};

window.saveLeaveBalance = async () => {
    const uid = window.currentEditLeaveBalId;
    if (!uid) return;
    const btn = document.getElementById('btnSaveLeaveBal'); if(btn) { btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...'; }
    try {
        const userDoc = await getDoc(doc(db, "users", uid)); const u = userDoc.data();
        const oldTotal = u.leaveTotal || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
        const oldBalances = u.leaveBalances || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
        const newTotal = { sick: parseInt(document.getElementById('editBalSick').value) || 0, personal: parseInt(document.getElementById('editBalPers').value) || 0, annual: parseInt(document.getElementById('editBalAnn').value) || 0, compensatory: parseInt(document.getElementById('editBalComp').value) || 0, maternity: parseInt(document.getElementById('editBalMat').value) || 0, ordination: parseInt(document.getElementById('editBalOrd').value) || 0, military: parseInt(document.getElementById('editBalMil').value) || 0 };
        const newBalances = {};
        for(let key in newTotal) {
            let usedDays = (oldTotal[key] || 0) - (oldBalances[key] || 0); 
            if(usedDays < 0) usedDays = 0;
            newBalances[key] = newTotal[key] - usedDays; 
        }
        await updateDoc(doc(db, "users", uid), { leaveTotal: newTotal, leaveBalances: newBalances });
        bootstrap.Modal.getInstance(document.getElementById('editLeaveBalanceModal')).hide(); window.showSwal('สำเร็จ', 'อัปเดตสิทธิ์การลาเรียบร้อย', 'success'); refreshUI();
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'บันทึกข้อมูลไม่สำเร็จ', 'error'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = 'บันทึกโควตาสิทธิ์การลา'; } }
};

window.changeRowsPerPage = () => {
    const select = document.getElementById('timeRowsPerPage');
    if(select) window.rowsPerPage = parseInt(select.value);
    window.renderTimeHistoryPage(1); 
};

window.renderTimeHistoryPage = (page = null) => {
    if(page) window.currentTimePage = page;
    const tbody = document.getElementById('myTimeHistoryTableBody');
    if(!tbody) return;

    const dateFilterStr = document.getElementById('timeHistoryDate') ? document.getElementById('timeHistoryDate').value : '';
    const todayStr = getSafeTodayString();

    let filtered = window.allTimeRecords.filter(r => { 
        if(!dateFilterStr) return true; 
        return r.workDate === dateFilterStr; 
    });
    
    let sumW = 0, sumO = 0;
    
    const refinedData = filtered.map(r => {
        let w = parseFloat(r.workHours || 0);
        let o = parseFloat(r.otHours || 0);
        if (r.timeIn && r.timeOut) {
            const hrCalc = window.calculateHRWorkHours(r.timeIn, r.timeOut);
            w = hrCalc.normal; o = hrCalc.ot;
        }
        sumW += w; sumO += o;
        return { ...r, calcW: w, calcO: o };
    });

    if(document.getElementById('sumWorkHr')) document.getElementById('sumWorkHr').innerText = sumW.toFixed(1);
    if(document.getElementById('sumOtHr')) document.getElementById('sumOtHr').innerText = sumO.toFixed(1);

    const totalRows = refinedData.length; const totalPages = Math.ceil(totalRows / window.rowsPerPage) || 1;
    if(window.currentTimePage < 1) window.currentTimePage = 1; if(window.currentTimePage > totalPages) window.currentTimePage = totalPages;
    const startIdx = (window.currentTimePage - 1) * window.rowsPerPage; const endIdx = startIdx + window.rowsPerPage;
    const paginated = refinedData.slice(startIdx, endIdx);

    if(document.getElementById('timePageInfo')) {
        const startText = totalRows > 0 ? startIdx + 1 : 0;
        const endText = Math.min(endIdx, totalRows);
        document.getElementById('timePageInfo').innerHTML = `<span class="fw-bold text-dark">${startText}-${endText}</span> จาก <span class="fw-bold text-dark">${totalRows}</span> รายการ`;
    }
    if(document.getElementById('btnPrevTime')) document.getElementById('btnPrevTime').disabled = window.currentTimePage === 1;
    if(document.getElementById('btnNextTime')) document.getElementById('btnNextTime').disabled = window.currentTimePage === totalPages;

    tbody.innerHTML = '';
    if (paginated.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-muted py-4">ไม่พบประวัติการลงเวลา</td></tr>'; return; }

    paginated.forEach(r => {
        const wHr = r.calcW.toFixed(1);
        const oHr = r.calcO.toFixed(1);
        let tOut = r.timeOut;
        let statusBadge = r.status === 'Completed' ? '<span class="badge bg-success-subtle text-success">เสร็จสิ้น</span>' : '<span class="badge bg-warning-subtle text-warning">กำลังทำงาน</span>';
        if(!r.timeOut && r.workDate < todayStr) { tOut = '<span class="text-danger fw-bold">ลืมลงเวลาออก</span>'; statusBadge = '<span class="badge bg-danger-subtle text-danger">ผิดปกติ</span>'; } 
        else if (!r.timeOut) { tOut = '<span class="text-warning small">ยังไม่ออกงาน</span>'; }

        let tInClass = 'text-success fw-medium'; if(r.timeIn && r.timeIn > '08:30') tInClass = 'text-danger fw-bold'; 
        const auditIcon = r.isCorrected ? ' <i class="bi bi-info-circle-fill text-primary" title="แก้ไขเวลาโดยผู้จัดการแล้ว"></i>' : '';

        const displayDate = window.formatDateShort(r.workDate, r.timestamp);

        let actionBtns = `<button class="btn btn-sm btn-outline-info me-1" onclick="window.viewWorkDetails('${r.id}')" title="ดูรายละเอียดงาน"><i class="bi bi-search"></i></button>`;
        if (r.correctionReq && r.correctionReq.status === 'รอพิจารณา') { actionBtns += `<span class="badge bg-warning-subtle text-warning ms-1">รออนุมัติแก้เวลา</span>`; } 
        else { const safeOut = r.timeOut ? r.timeOut : ''; actionBtns += `<button class="btn btn-sm btn-outline-danger" onclick="window.requestTimeCorrection('${r.id}', '${r.workDate}', '${r.timeIn||''}', '${safeOut}')" title="ขอแก้ไขเวลา"><i class="bi bi-pencil-square"></i></button>`; }

        tbody.innerHTML += `<tr><td>${displayDate}</td><td>${r.location || '-'}${auditIcon}</td><td class="${tInClass}">${r.timeIn || '-'}</td><td class="fw-medium">${tOut}</td><td class="fw-bold text-dark">${wHr}</td><td class="fw-bold text-primary">${oHr}</td><td>${statusBadge}</td><td>${actionBtns}</td></tr>`;
    });
};

window.changeTimePage = (step) => { window.currentTimePage += step; window.renderTimeHistoryPage(); };

window.viewWorkDetails = (id) => {
    const r = window.allTimeRecords.find(x => x.id === id); if(!r) return;
    const displayDate = window.formatDateFull(r.workDate, r.timestamp);
    Swal.fire({ title: `รายละเอียดงาน<br><span class="fs-6 text-muted">${displayDate}</span>`, html: `<div class="text-start bg-light p-3 rounded border"><b>สถานที่:</b> <span class="text-primary">${r.location}</span><br><b>เวลาทำงาน:</b> ${r.timeIn} - ${r.timeOut || 'ยังไม่ออกงาน'}<br><hr><b>เนื้องานที่บันทึก:</b><br>${r.details || '<span class="text-muted">ไม่มีรายละเอียด</span>'}</div>`, confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#2563eb' });
};

window.requestTimeCorrection = (id, date, curIn, curOut) => {
    const displayDate = window.formatDateFull(date);
    Swal.fire({
        title: 'ยื่นคำร้องขอแก้ไขเวลา',
        html: `<div class="text-start"><p class="text-muted small mb-3">วันที่: ${displayDate}</p><label class="form-label small fw-bold">เวลาเข้างาน</label><input type="time" id="reqTimeIn" class="form-control mb-3" value="${curIn}"><label class="form-label small fw-bold">เวลาออกงาน</label><input type="time" id="reqTimeOut" class="form-control mb-3" value="${curOut}"><label class="form-label small fw-bold">เหตุผลการขอแก้ไข <span class="text-danger">*</span></label><input type="text" id="reqReason" class="form-control" placeholder="เช่น ลืมสแกนนิ้ว, ระบบค้าง..." required></div>`,
        showCancelButton: true, confirmButtonText: 'ส่งคำร้อง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563eb',
        preConfirm: () => {
            const rin = document.getElementById('reqTimeIn').value; const rout = document.getElementById('reqTimeOut').value; const rreason = document.getElementById('reqReason').value;
            if(!rin || !rout || !rreason) { Swal.showValidationMessage('กรุณากรอกเวลาและเหตุผลให้ครบถ้วน'); return false; }
            return { in: rin, out: rout, reason: rreason };
        }
    }).then(async (result) => {
        if(result.isConfirmed) {
            await updateDoc(doc(db, "workRecords", id), { correctionReq: { timeIn: result.value.in, timeOut: result.value.out, reason: result.value.reason, status: 'รอพิจารณา' } });
            window.showSwal('ส่งคำร้องสำเร็จ', 'ระบบส่งคำขอไปยังหัวหน้างานแล้ว', 'success'); refreshUI();
        }
    });
};

window.approveTimeCorrection = async (recordId, isApprove) => {
    const docRef = doc(db, "workRecords", recordId);
    const snap = await getDoc(docRef); if(!snap.exists()) return;
    const data = snap.data();
    if(isApprove) {
        const req = data.correctionReq;
        const hrCalc = window.calculateHRWorkHours(req.timeIn, req.timeOut);
        await updateDoc(docRef, { timeIn: req.timeIn, timeOut: req.timeOut, workHours: parseFloat(hrCalc.normal.toFixed(1)), otHours: parseFloat(hrCalc.ot.toFixed(1)), isCorrected: true, status: "Completed", correctionReq: null });
        window.showSwal('อนุมัติสำเร็จ', 'อัปเดตเวลาให้พนักงานเรียบร้อยแล้ว', 'success');
    } else {
        await updateDoc(docRef, { correctionReq: null }); window.showSwal('ปฏิเสธคำร้อง', 'ยกเลิกคำขอแก้ไขเวลาแล้ว', 'info');
    }
    refreshUI();
};

const refreshUI = async () => {
    if (!currentUser) return; 
    try {
        if (currentUser.role === 'employee' && typeof window.renderEmployeeUI === 'function') await window.renderEmployeeUI();
        if (currentUser.role === 'leader' && typeof window.renderManagerUI === 'function') await window.renderManagerUI();
        if (currentUser.role === 'admin' && typeof window.renderAdminUI === 'function') await window.renderAdminUI();
    } catch (err) { console.error("Rendering Error: ", err); }
};

window.renderAdminUI = async () => {
    if(!document.getElementById('adminEmployeeTableBody')) return;
    ['adminEmployeeTableBody', 'adminLeaveBalanceTableBody', 'adminReportTableBody', 'adminApproveManagerTableBody', 'adminApproveTimeTableBody'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = '<tr><td colspan="10" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
    });

    const usersSnap = await getDocs(collection(db, "users")); 
    window.allUsers = usersSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    
    const leavesSnap = await getDocs(collection(db, "leaves")); 
    window.allLeaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
    window.allLeaves.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    const workSnap = await getDocs(collection(db, "workRecords")); 
    const allWork = workSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const empTbody = document.getElementById('adminEmployeeTableBody'); empTbody.innerHTML = '';
    const leaveBalTbody = document.getElementById('adminLeaveBalanceTableBody'); if(leaveBalTbody) leaveBalTbody.innerHTML = '';

    window.allUsers.forEach((u, index) => {
        const safeUid = u.uid || u.docId; 
        const displayIdCard = u.idCard ? 'x-xxxx-xxxxx-xx-x' : '-';
        empTbody.innerHTML += `<tr><td>${index+1}</td><td><span class="fw-bold text-primary">${safeUid}</span></td><td><span class="text-muted fw-bold">${displayIdCard}</span></td><td><span class="fw-medium">${u.Name || '-'} ${u.SurName || ''}</span></td><td>${getRoleBadge(u.role)}</td><td><div class="d-flex justify-content-center gap-2"><button class="btn btn-sm btn-outline-secondary" onclick="window.openEditEmployeeModal('${safeUid}')"><i class="bi bi-pencil"></i> แก้ไข</button><button class="btn btn-sm btn-outline-danger" onclick="window.deleteEmployee('${safeUid}')"><i class="bi bi-trash"></i> ลบ</button></div></td></tr>`;
        
        if(leaveBalTbody) {
            const bal = u.leaveBalances || { sick: 0, personal: 0, annual: 0, compensatory: 0, maternity: 0, ordination: 0, military: 0 };
            const tot = u.leaveTotal || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
            leaveBalTbody.innerHTML += `<tr><td>${index+1}</td><td><span class="fw-bold text-dark">${safeUid}</span></td><td><span class="fw-medium">${u.Name || '-'} ${u.SurName || ''}</span></td>
                <td class="text-primary fw-bold">${bal.sick||0} <span class="text-muted small">/ ${tot.sick||0}</span></td>
                <td class="text-primary fw-bold">${bal.personal||0} <span class="text-muted small">/ ${tot.personal||0}</span></td>
                <td class="text-primary fw-bold">${bal.annual||0} <span class="text-muted small">/ ${tot.annual||0}</span></td>
                <td class="text-info fw-bold">${bal.compensatory||0} <span class="text-muted small">/ ${tot.compensatory||0}</span></td>
                <td class="text-secondary">${bal.maternity||0} <span class="text-muted small">/ ${tot.maternity||0}</span></td>
                <td class="text-secondary">${bal.ordination||0} <span class="text-muted small">/ ${tot.ordination||0}</span></td>
                <td class="text-secondary">${bal.military||0} <span class="text-muted small">/ ${tot.military||0}</span></td>
                <td><button class="btn btn-sm btn-outline-primary fw-bold rounded-pill px-3" onclick="window.openEditLeaveBalanceModal('${safeUid}')"><i class="bi bi-sliders"></i> ปรับสิทธิ์</button></td></tr>`;
        }
    });

    const filterStatus = document.getElementById('adminFilterStatus') ? document.getElementById('adminFilterStatus').value : 'all';
    const adminDateFilter = document.getElementById('adminReportDateFilter') ? document.getElementById('adminReportDateFilter').value : '';

    const reportTbody = document.getElementById('adminReportTableBody');
    if(reportTbody) {
        reportTbody.innerHTML = ''; let no = 1;
        window.allLeaves.forEach(l => {
            if(filterStatus !== 'all' && l.status !== filterStatus) return;
            if(adminDateFilter) {
                const lDate = l.startDate || l.date || '';
                if(lDate !== adminDateFilter) return;
            }

            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); 
            const displayType = l.type === 'other' ? `ลาอื่นๆ (${l.typeOther || '-'})` : leaveTypesTH[l.type];
            const displaySubmit = window.formatDateShort(l.submittedDate, l.timestamp, l.startDate || l.date);
            const dStart = window.formatDateShort(l.startDate || l.date); 
            const dEnd = (l.endDate && l.endDate !== (l.startDate || l.date)) ? `<br>ถึง ${window.formatDateShort(l.endDate)}` : '';
            
            reportTbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium text-primary">${l.empID}</span></td><td>${u ? u.Name : '-'}</td><td>${displaySubmit}</td><td>${dStart}${dEnd}</td><td>${displayType}</td><td><button class="btn btn-sm btn-outline-info rounded-pill px-3 fw-bold" onclick="window.viewLeaveDetail('${l.id}')"><i class="bi bi-search me-1"></i> ตรวจสอบ</button></td><td>${getStatusBadge(l.status)}</td></tr>`;
        });
        if(no === 1) reportTbody.innerHTML = '<tr><td colspan="8" class="text-muted py-4">ไม่พบข้อมูลการลาที่ค้นหา</td></tr>';
    }

    const approveTbody = document.getElementById('adminApproveManagerTableBody');
    if(approveTbody) {
        approveTbody.innerHTML = ''; let no = 1;
        window.allLeaves.filter(l => (l.status === 'รอพิจารณา' || l.status === 'ขอยกเลิก') && window.allUsers.find(x => (x.uid || x.docId) === l.empID)?.role === 'leader').forEach(l => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); 
            const displaySubmit = window.formatDateShort(l.submittedDate, l.timestamp, l.startDate || l.date);
            const dStart = window.formatDateShort(l.startDate || l.date); 
            const dEnd = (l.endDate && l.endDate !== (l.startDate || l.date)) ? ` - ${window.formatDateShort(l.endDate)}` : '';
            const displayType = l.type === 'other' ? `ลาอื่นๆ (${l.typeOther || '-'})` : leaveTypesTH[l.type];
            
            approveTbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${displaySubmit}</td><td>${dStart}${dEnd}</td><td>${displayType}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info rounded-pill px-3 fw-bold" onclick="window.viewLeaveDetail('${l.id}')"><i class="bi bi-search me-1"></i> ตรวจสอบ</button></td></tr>`;
        });
    }

    const adminTimeTbody = document.getElementById('adminApproveTimeTableBody');
    if(adminTimeTbody) {
        adminTimeTbody.innerHTML = '';
        const adminTimeReqs = allWork.filter(w => w.correctionReq && w.correctionReq.status === 'รอพิจารณา' && window.allUsers.find(u => (u.uid || u.docId) === w.empID)?.role === 'leader');
        adminTimeReqs.forEach(r => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === r.empID); 
            const displayDate = window.formatDateShort(r.workDate);
            const curTime = `${r.timeIn||'-'} - ${r.timeOut||'-'}`; 
            const reqTime = `<span class="text-primary fw-bold">${r.correctionReq.timeIn} - ${r.correctionReq.timeOut}</span>`;
            adminTimeTbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${displayDate}</td><td>${curTime}</td><td>${reqTime}</td><td>${r.correctionReq.reason}</td><td><button class="btn btn-sm btn-primary me-1" onclick="window.approveTimeCorrection('${r.id}', true)">อนุมัติ</button><button class="btn btn-sm btn-outline-danger" onclick="window.approveTimeCorrection('${r.id}', false)">ไม่อนุมัติ</button></td></tr>`;
        });
    }
};

window.renderManagerUI = async () => {
    await window.renderEmployeeUI(); 
    const usersSnap = await getDocs(collection(db, "users")); window.allUsers = usersSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    const leavesSnap = await getDocs(collection(db, "leaves")); window.allLeaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.allLeaves.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const workSnap = await getDocs(collection(db, "workRecords")); const allWork = workSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tbody = document.getElementById('managerApprovalTableBody');
    if(tbody) {
        tbody.innerHTML = ''; let no = 1;
        window.allLeaves.filter(l => (l.status === 'รอพิจารณา' || l.status === 'ขอยกเลิก') && window.allUsers.find(u => (u.uid || u.docId) === l.empID)?.role === 'employee').forEach(l => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); 
            const displaySubmit = window.formatDateShort(l.submittedDate, l.timestamp, l.startDate || l.date);
            const dStart = window.formatDateShort(l.startDate || l.date); 
            const dEnd = (l.endDate && l.endDate !== (l.startDate || l.date)) ? ` - ${window.formatDateShort(l.endDate)}` : '';
            const displayType = l.type === 'other' ? `ลาอื่นๆ (${l.typeOther || '-'})` : leaveTypesTH[l.type];
            
            tbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${displaySubmit}</td><td>${dStart}${dEnd}</td><td>${displayType}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info rounded-pill px-3 fw-bold" onclick="window.viewLeaveDetail('${l.id}')"><i class="bi bi-search me-1"></i> ตรวจสอบ</button></td></tr>`;
        });
    }

    const mgrTimeTbody = document.getElementById('managerApproveTimeTableBody');
    if(mgrTimeTbody) {
        mgrTimeTbody.innerHTML = '';
        const mgrTimeReqs = allWork.filter(w => w.correctionReq && w.correctionReq.status === 'รอพิจารณา' && window.allUsers.find(u => (u.uid || u.docId) === w.empID)?.role === 'employee');
        mgrTimeReqs.forEach(r => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === r.empID); 
            const displayDate = window.formatDateShort(r.workDate);
            const curTime = `${r.timeIn||'-'} - ${r.timeOut||'-'}`; 
            const reqTime = `<span class="text-primary fw-bold">${r.correctionReq.timeIn} - ${r.correctionReq.timeOut}</span>`;
            mgrTimeTbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${displayDate}</td><td>${curTime}</td><td>${reqTime}</td><td>${r.correctionReq.reason}</td><td><button class="btn btn-sm btn-primary me-1 mb-1" onclick="window.approveTimeCorrection('${r.id}', true)">อนุมัติ</button><button class="btn btn-sm btn-outline-danger me-1 mb-1" onclick="window.approveTimeCorrection('${r.id}', false)">ไม่อนุมัติ</button></td></tr>`;
        });
    }
};

window.renderEmployeeUI = async () => {
    if(document.getElementById('myLeaveStatusTable')) document.getElementById('myLeaveStatusTable').innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if(userDoc.exists()) { currentUser = userDoc.data(); currentUser.uid = currentUser.uid || userDoc.id; }
    
    const fullName = `${currentUser.Name || ''} ${currentUser.SurName || ''}`.trim();
    ['Menu', 'Time', 'LeaveHead', 'LeaveTable'].forEach(s => { 
        if(document.getElementById(`empProfileName${s}`)) document.getElementById(`empProfileName${s}`).innerText = fullName; 
    });
    
    if(document.getElementById('empProfileId')) document.getElementById('empProfileId').innerText = currentUser.uid;
    if(document.getElementById('empProfileRole')) document.getElementById('empProfileRole').innerText = currentUser.role === 'leader' ? 'Manager' : 'Staff';

    if(document.getElementById('statPersBal')) {
        const total = currentUser.leaveTotal || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 }; 
        const balances = currentUser.leaveBalances || { sick: 30, personal: 3, annual: 6, compensatory: 0, maternity: 90, ordination: 15, military: 30 };
        const calcUsed = (t, b) => Math.max(0, (t || 0) - (b || 0));

        if(document.getElementById('statPersTotal')) document.getElementById('statPersTotal').innerText = total.personal || 0;
        document.getElementById('statPersBal').innerText = balances.personal !== undefined ? balances.personal : 0; 
        document.getElementById('statPersUsed').innerText = calcUsed(total.personal, balances.personal);
        
        if(document.getElementById('statSickTotal')) document.getElementById('statSickTotal').innerText = total.sick || 0;
        document.getElementById('statSickBal').innerText = balances.sick !== undefined ? balances.sick : 0; 
        document.getElementById('statSickUsed').innerText = calcUsed(total.sick, balances.sick);
        
        if(document.getElementById('statAnnTotal')) document.getElementById('statAnnTotal').innerText = total.annual || 0;
        document.getElementById('statAnnBal').innerText = balances.annual !== undefined ? balances.annual : 0; 
        document.getElementById('statAnnUsed').innerText = calcUsed(total.annual, balances.annual);

        // 🌟 เพิ่มตัวเลขวันสุทธิใน Dropdown แบบมืออาชีพ
        const stdSelect = document.querySelector('#standardLeaveContainer select');
        if (stdSelect) {
            for(let opt of stdSelect.options) {
                if(opt.value === 'sick') opt.text = `ลาป่วย (คงเหลือ ${balances.sick ?? 0} วัน)`;
                if(opt.value === 'personal') opt.text = `ลากิจ (คงเหลือ ${balances.personal ?? 0} วัน)`;
                if(opt.value === 'annual') opt.text = `ลาพักร้อน (คงเหลือ ${balances.annual ?? 0} วัน)`;
            }
        }
        const legalSelect = document.querySelector('#legalLeaveContainer select');
        if (legalSelect) {
            for(let opt of legalSelect.options) {
                if(opt.value === 'compensatory') opt.text = `วันหยุดชดเชย (สุทธิ ${balances.compensatory ?? 0} วัน)`;
                if(opt.value === 'maternity') opt.text = `ลาคลอด (สุทธิ ${balances.maternity ?? 90} วัน)`;
                if(opt.value === 'ordination') opt.text = `ลาบวช (สุทธิ ${balances.ordination ?? 15} วัน)`;
                if(opt.value === 'military') opt.text = `ลาเกณฑ์ทหาร (สุทธิ ${balances.military ?? 30} วัน)`;
            }
        }
    }

    const leavesSnap = await getDocs(query(collection(db, "leaves"), where("empID", "==", currentUser.uid)));
    window.allLeaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.allLeaves.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 

    if(document.getElementById('leaveHistoryBadge')) document.getElementById('leaveHistoryBadge').innerText = window.allLeaves.length;

    const lTbody = document.getElementById('myLeaveStatusTable');
    if(lTbody) {
        lTbody.innerHTML = ''; let no = 1;
        if(window.allLeaves.length === 0) lTbody.innerHTML = '<tr><td colspan="7" class="text-muted py-4">ไม่พบประวัติการลา</td></tr>';
        
        window.allLeaves.forEach(l => {
            let cancelBtn = '-';
            if (l.status === 'รอพิจารณา') cancelBtn = `<button class="btn btn-sm btn-outline-danger" onclick="window.cancelMyLeave('${l.id}')">ยกเลิก</button>`;
            else if (l.status === 'อนุมัติ') cancelBtn = `<button class="btn btn-sm btn-outline-warning" onclick="window.requestCancelLeave('${l.id}')">ขอยกเลิก</button>`;
            else if (l.status === 'ขอยกเลิก') cancelBtn = `<span class="badge bg-warning-subtle text-warning">รออนุมัติยกเลิก</span>`;
            
            const displaySubmit = window.formatDateShort(l.submittedDate, l.timestamp, l.startDate || l.date);
            const dStart = window.formatDateShort(l.startDate || l.date); 
            const dEnd = (l.endDate && l.endDate !== (l.startDate || l.date)) ? ` / ${window.formatDateShort(l.endDate)}` : '';
            const displayType = l.type === 'other' ? `ลาอื่นๆ (${l.typeOther || '-'})` : leaveTypesTH[l.type];
            
            lTbody.innerHTML += `<tr><td>${no++}</td><td>${displaySubmit}</td><td>${dStart}${dEnd}</td><td>${displayType}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info me-1 rounded-pill px-3 fw-bold" onclick="window.viewLeaveDetail('${l.id}')"><i class="bi bi-search me-1"></i> ตรวจสอบ</button></td><td>${cancelBtn}</td></tr>`;
        });
    }

    const todayStr = getSafeTodayString();
    if(document.getElementById('empCurrentDateDisplay')) {
        document.getElementById('empCurrentDateDisplay').innerText = window.formatDateFull(todayStr);
    }
    
    const timeSnap = await getDocs(query(collection(db, "workRecords"), where("empID", "==", currentUser.uid)));
    window.allTimeRecords = timeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.allTimeRecords.sort((a, b) => new Date(b.workDate) - new Date(a.workDate)); 
    
    window.renderTimeHistoryPage(1);

    const todayRecord = window.allTimeRecords.find(r => r.workDate === todayStr);
    const btnStamp = document.getElementById('btnStampTime');
    if (todayRecord) {
        document.getElementById('displayCheckIn').innerText = todayRecord.timeIn || '-'; 
        document.getElementById('displayCheckOut').innerText = todayRecord.timeOut || '-';
        
        let wHr = '0.0'; let oHr = '0.0';
        if (todayRecord.timeOut) {
            wHr = parseFloat(todayRecord.workHours).toFixed(1);
            oHr = parseFloat(todayRecord.otHours).toFixed(1);
        }
        document.getElementById('displayWorkHr').innerText = wHr; 
        document.getElementById('displayOtHr').innerText = oHr;
        
        document.getElementById('workLocation').value = todayRecord.location || ''; 
        document.getElementById('workDetails').value = todayRecord.details || '';
        
        if (!todayRecord.timeOut) { 
            btnStamp.disabled = false; btnStamp.className = "btn btn-danger btn-lg w-100 rounded-pill shadow-sm py-3 fw-bold"; btnStamp.innerHTML = 'แสตมป์ออกงาน'; 
        } else { 
            btnStamp.disabled = true; btnStamp.className = "btn btn-outline-secondary btn-lg w-100 rounded-pill py-3 fw-bold"; btnStamp.innerHTML = 'บันทึกเวลาครบแล้ว'; 
        }
    } else {
        document.getElementById('displayCheckIn').innerText = '-'; document.getElementById('displayCheckOut').innerText = '-';
        document.getElementById('displayWorkHr').innerText = '0.0'; document.getElementById('displayOtHr').innerText = '0.0';
        document.getElementById('workLocation').value = ''; document.getElementById('workDetails').value = '';
        btnStamp.disabled = false; btnStamp.className = "btn btn-primary btn-lg w-100 rounded-pill shadow-sm py-3 fw-bold"; btnStamp.innerHTML = 'แสตมป์เข้างาน';
    }
};

const startRealtimeClock = () => {
    const clockEl = document.getElementById('empCurrentTime');
    if(clockEl) {
        clockEl.innerText = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    }
};
startRealtimeClock(); 
setInterval(startRealtimeClock, 1000);

const initApp = () => {
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path.endsWith('/') || path === '') {
        window.checkAuthStatus('login');
    } else {
        if (!currentUser) {
            window.location.replace('index.html');
            return;
        }
        
        if (path.includes('employee.html')) { window.checkAuthStatus('employee'); refreshUI(); } 
        else if (path.includes('manager.html')) { window.checkAuthStatus('leader'); refreshUI(); } 
        else if (path.includes('admin.html')) { window.checkAuthStatus('admin'); refreshUI(); }
    }
};

initApp();
