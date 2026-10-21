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

let currentUser = JSON.parse(sessionStorage.getItem('hr_currentUser'));
const leaveTypesTH = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน', maternity: 'ลาคลอด', ordination: 'ลาบวช', military: 'ลาเกณฑ์ทหาร' };

window.allTimeRecords = [];
window.allLeaves = []; 
window.allUsers = []; 
window.currentTimePage = 1;
window.rowsPerPage = 10;

window.showSwal = (title, text, icon = 'success') => {
    if (typeof Swal !== 'undefined') { Swal.fire({ title, text, icon, confirmButtonText: 'ตกลง', confirmButtonColor: '#2563eb', timer: icon === 'success' ? 2500 : undefined, customClass: { popup: 'rounded-4' } });
    } else { alert(`${title}\n${text}`); }
};

window.navigate = (sectionId) => {
    document.querySelectorAll('.spa-section').forEach(el => el.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
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
    if (!currentUser && reqRole !== 'login') { window.location.href = 'index.html'; return false; }
    if (currentUser && reqRole === 'login') { window.location.href = currentUser.role === 'leader' ? 'manager.html' : `${currentUser.role}.html`; return false; }
    if (currentUser && document.getElementById('navUserInfo')) { document.getElementById('navUserInfo').innerText = `${currentUser.Name} ${currentUser.SurName || ''} (${currentUser.role.toUpperCase()})`; }
    return true;
};

window.handleLogin = async (e) => {
    e.preventDefault();
    const userInp = document.getElementById('loginUsername').value;
    const passInp = document.getElementById('loginPassword').value;
    try {
        const userDoc = await getDoc(doc(db, "users", userInp));
        if (userDoc.exists() && userDoc.data().password === passInp) {
            const userData = userDoc.data();
            userData.uid = userData.uid || userDoc.id; 
            sessionStorage.setItem('hr_currentUser', JSON.stringify(userData));
            window.location.href = userData.role === 'leader' ? 'manager.html' : `${userData.role}.html`;
        } else { window.showSwal('เข้าสู่ระบบไม่สำเร็จ', 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error'); }
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); }
};

window.logout = () => {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก' })
    .then((result) => { if (result.isConfirmed) { sessionStorage.removeItem('hr_currentUser'); window.location.href = 'index.html'; } });
};

window.previewCertImage = (leaveId) => {
    const l = window.allLeaves.find(x => x.id === leaveId);
    if (!l || !l.certUrl) return window.showSwal('ไม่พบไฟล์', 'ไม่มีไฟล์เอกสารแนบในรายการนี้', 'warning');

    const base64Data = l.certUrl;

    if (base64Data.startsWith('data:application/pdf')) {
        Swal.fire({
            title: 'เอกสาร PDF',
            html: `<iframe src="${base64Data}" width="100%" height="400px" style="border: none; border-radius: 8px;"></iframe>`,
            width: '800px',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: { popup: 'rounded-4' }
        });
        return;
    }

    Swal.fire({
        title: `ใบรับรองแพทย์ / เอกสารอ้างอิง`,
        imageUrl: base64Data,
        imageAlt: 'เอกสารแนบ',
        customClass: { image: 'img-fluid rounded border shadow-sm my-3', popup: 'rounded-4' },
        imageMaxHeight: 450,
        showConfirmButton: true,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#2563eb',
        showCancelButton: true,
        cancelButtonText: '<i class="bi bi-download me-1"></i> ดาวน์โหลดรูป',
        cancelButtonColor: '#10b981'
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            const a = document.createElement('a');
            a.href = base64Data;
            a.download = `Medical_Cert_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });
};

const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000; const MAX_HEIGHT = 1000;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
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

// ==========================================
// 🌟 4. Work Records (เด้งกลับหน้าแรกตอน Check-in สำเร็จ)
// ==========================================
window.handleStampTime = async () => {
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    if(!loc || !det.trim()) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุสถานที่และรายละเอียดงาน', 'warning');

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
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
                    await addDoc(recordsRef, { empID: currentUser.uid, timestamp: now, workDate: todayStr, timeIn: currentTime, timeOut: "", workHours: 0.0, otHours: 0.0, details: det, location: loc, status: "Working" });
                    
                    Swal.fire({ title: 'CHECK-IN สำเร็จ', text: `เข้างานเวลา: ${currentTime} น.`, icon: 'success', timer: 2000, showConfirmButton: false });
                    await refreshUI();
                    
                    // 🌟 เด้งกลับหน้า Menu ทันทีเมื่อ Check-in เสร็จ
                    window.navigate('sectionMenu'); 
                    window.scrollTo(0, 0);

                } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกเวลาได้', 'error'); if(btn) { btn.disabled = false; btn.innerHTML = 'แสตมป์เวลา'; } }
            }
        });
    } else {
        const recordDoc = snapshot.docs[0];
        const recordData = recordDoc.data();
        if (recordData.timeOut) return window.showSwal('แจ้งเตือน', 'คุณได้บันทึกเวลาออกงานของวันนี้ไปแล้ว', 'warning');

        Swal.fire({ title: 'ยืนยัน CHECK-OUT?', html: `คุณกำลังจะออกงานเวลา <b>${currentTime} น.</b><br><br><span class="text-danger small">*เมื่อบันทึกแล้วระบบจะทำการออกจากระบบอัตโนมัติ</span>`, icon: 'question', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'บันทึกออกงาน', cancelButtonText: 'ยกเลิก' }).then(async (result) => { 
            if (result.isConfirmed) {
                const btn = document.getElementById('btnStampTime');
                if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...'; }
                try {
                    const tIn = new Date(`${todayStr}T${recordData.timeIn}`);
                    const tOut = new Date(`${todayStr}T${currentTime}`);
                    let diffHrs = (tOut - tIn) / 3600000;
                    if(tIn.getHours() <= 12 && tOut.getHours() >= 13) diffHrs -= 1;
                    diffHrs = Math.max(0, diffHrs);
                    let normalHrs = Math.min(8, diffHrs);
                    let rawOt = Math.max(0, diffHrs - 8);
                    let otHrs = Math.floor(rawOt * 2) / 2;

                    await updateDoc(doc(db, "workRecords", recordDoc.id), { timeOut: currentTime, workHours: parseFloat(normalHrs.toFixed(2)), otHours: parseFloat(otHrs.toFixed(2)), details: det, location: loc, status: "Completed" });
                    Swal.fire({ title: 'บันทึกเวลาสำเร็จ', html: `เวลาทำงาน: <b>${normalHrs.toFixed(2)}</b> ชม.<br>OT: <b>${otHrs.toFixed(2)}</b> ชม.<br><br><span class="text-danger small">กำลังออกจากระบบ...</span>`, icon: 'success', timer: 3000, showConfirmButton: false, allowOutsideClick: false })
                    .then(() => { sessionStorage.removeItem('hr_currentUser'); window.location.href = 'index.html'; });
                } catch (error) { window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกเวลาได้', 'error'); if(btn) { btn.disabled = false; btn.innerHTML = 'แสตมป์เวลา'; } }
            }
        });
    }
};

window.saveDailyDetails = async (e) => {
    e.preventDefault();
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    const todayStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, "workRecords"), where("empID", "==", currentUser.uid), where("workDate", "==", todayStr));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) { await updateDoc(doc(db, "workRecords", snapshot.docs[0].id), { location: loc, details: det }); window.showSwal('บันทึกสำเร็จ', 'อัปเดตรายละเอียดงานเรียบร้อย', 'success'); } 
    else { window.showSwal('ข้อผิดพลาด', 'กรุณา CHECK-IN ก่อนบันทึกรายละเอียด', 'error'); }
};

window.handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value || startDate;
    const reason = document.getElementById('leaveReason').value;
    const fileInput = document.getElementById('leaveCertFile');
    
    if(!type || !startDate) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุประเภทและวันที่', 'warning');
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    if(days <= 0) return window.showSwal('ข้อผิดพลาด', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น', 'error');
    if(currentUser.leaveBalances && currentUser.leaveBalances[type] !== undefined && currentUser.leaveBalances[type] < days) { 
        return window.showSwal('สิทธิหมด', `สิทธิ ${leaveTypesTH[type]} คงเหลือไม่พอสำหรับการลา ${days} วัน`, 'error'); 
    }

    let fileUrl = "";
    let hasCert = false;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        window.showSwal('กำลังประมวลผล', 'ระบบกำลังเตรียมไฟล์เอกสาร กรุณารอสักครู่...', 'info');
        
        try {
            if (file.type.startsWith('image/')) {
                fileUrl = await compressImage(file);
            } else if (file.type === 'application/pdf') {
                if (file.size > 500 * 1024) return window.showSwal('ไฟล์ใหญ่เกินไป', 'ไฟล์ PDF ต้องมีขนาดไม่เกิน 500KB', 'warning');
                fileUrl = await getBase64(file);
            }
            hasCert = true;
        } catch (error) {
            console.error(error);
            return window.showSwal('ข้อผิดพลาด', 'ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่อีกครั้ง', 'error');
        }
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    
    try {
        await addDoc(collection(db, "leaves"), { 
            empID: currentUser.uid, type, submittedDate: todayStr, startDate, endDate, days, reason, hasCert, certUrl: fileUrl, status: 'รอพิจารณา', timestamp: new Date().getTime() 
        });
        
        e.target.reset(); 
        window.showSwal('ยื่นคำขอสำเร็จ', 'ระบบได้รับคำขออนุมัติเรียบร้อยแล้ว', 'success'); 
        await refreshUI();
        
        const historyTabBtn = document.getElementById('tab-leave-history-btn');
        if(historyTabBtn) {
            const tab = new bootstrap.Tab(historyTabBtn);
            tab.show();
        }
    } catch (err) {
        console.error(err);
        window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ (ไฟล์อาจใหญ่เกินไป)', 'error');
    }
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
        if (userData.leaveBalances && userData.leaveBalances[type] !== undefined) {
            if(newStatus === 'อนุมัติ' && currentStatus === 'รอพิจารณา') { userData.leaveBalances[type] -= days; } 
            else if(newStatus === 'ยกเลิก' && currentStatus === 'ขอยกเลิก') { userData.leaveBalances[type] += days; }
            await updateDoc(userDocRef, { leaveBalances: userData.leaveBalances });
        }
    }
    window.showSwal('บันทึกสำเร็จ', `สถานะ: ${newStatus}`, newStatus.includes('อนุมัติ') || newStatus === 'ยกเลิก' ? 'success' : 'info'); refreshUI();
};

window.viewLeaveDetail = async (leaveId) => {
    try {
        const l = window.allLeaves.find(x => x.id === leaveId);
        if(!l) return;
        const uDoc = await getDoc(doc(db, "users", l.empID)); const u = uDoc.data();
        const displayStart = l.startDate || l.date || '-';
        const displayEnd = (l.endDate && l.endDate !== displayStart && l.startDate) ? ` ถึง ${l.endDate}` : '';
        
        const certHtml = l.certUrl 
            ? `<button type="button" class="btn btn-sm btn-outline-primary fw-bold w-100 py-2 rounded-3" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-image me-1"></i>ดูรูปใบรับรองแพทย์/เอกสาร</button>` 
            : (l.hasCert ? '<span class="badge bg-success-subtle text-success">มีเอกสารแนบ</span>' : '<span class="badge bg-secondary-subtle text-secondary">ไม่มีเอกสารแนบ</span>');
        
        const content = `
            <div class="mb-4 text-center border-bottom pb-3">
                <div class="mb-2"><span class="fs-1 text-primary">📄</span></div>
                <h5 class="fw-bold mb-1 text-dark">${u.Name} ${u.SurName || ''}</h5>
                <small class="text-muted">รหัสพนักงาน: ${u.uid || l.empID}</small>
            </div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">สถานะคำขอ</label><div>${getStatusBadge(l.status)}</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">ประเภทการลา</label><div class="fw-bold text-primary fs-6">${leaveTypesTH[l.type]} (${l.days || 1} วัน)</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">วันที่ยื่นเรื่อง</label><div class="text-dark">${l.submittedDate || '-'}</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">ช่วงวันที่ลา</label><div class="text-dark fw-medium">${displayStart}${displayEnd}</div></div>
            <div class="mb-3"><label class="small text-muted d-block mb-1 fw-bold">เอกสารแนบประกอบ</label><div>${certHtml}</div></div>
            <div class="mb-4"><label class="small text-muted d-block mb-1 fw-bold">เหตุผลการลา</label><div class="p-3 bg-light rounded-3 text-dark border">${l.reason}</div></div>
            <button class="btn btn-secondary w-100 fw-bold" data-bs-dismiss="offcanvas">ปิดหน้าต่าง</button>
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
    await setDoc(doc(db, "users", newId), { uid: newId, idCard: idCard, password: autoPassword, Name: document.getElementById('regName').value, SurName: '', role: document.getElementById('regRole').value, leaveBalances: { sick: 30, personal: 3, annual: 6, maternity: 90, ordination: 15, military: 30 }, leaveTotal: { sick: 30, personal: 3, annual: 6, maternity: 90, ordination: 15, military: 30 } });
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
            const bal = u.leaveBalances || { sick: 0, personal: 0, annual: 0, maternity: 0, ordination: 0, military: 0 };
            document.getElementById('editBalSick').value = bal.sick || 0; document.getElementById('editBalPers').value = bal.personal || 0; document.getElementById('editBalAnn').value = bal.annual || 0; document.getElementById('editBalMat').value = bal.maternity || 0; document.getElementById('editBalOrd').value = bal.ordination || 0; document.getElementById('editBalMil').value = bal.military || 0;
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
        let newBalances = u.leaveBalances || {};
        newBalances.sick = parseInt(document.getElementById('editBalSick').value) || 0; newBalances.personal = parseInt(document.getElementById('editBalPers').value) || 0; newBalances.annual = parseInt(document.getElementById('editBalAnn').value) || 0; newBalances.maternity = parseInt(document.getElementById('editBalMat').value) || 0; newBalances.ordination = parseInt(document.getElementById('editBalOrd').value) || 0; newBalances.military = parseInt(document.getElementById('editBalMil').value) || 0;
        await updateDoc(doc(db, "users", uid), { leaveBalances: newBalances });
        bootstrap.Modal.getInstance(document.getElementById('editLeaveBalanceModal')).hide(); window.showSwal('สำเร็จ', 'อัปเดตสิทธิ์การลาเรียบร้อย', 'success'); refreshUI();
    } catch (error) { window.showSwal('ข้อผิดพลาด', 'บันทึกข้อมูลไม่สำเร็จ', 'error'); } finally { if(btn) { btn.disabled = false; btn.innerHTML = 'บันทึกสิทธิ์การลา'; } }
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

    const monthFilterStr = document.getElementById('timeHistoryMonth') ? document.getElementById('timeHistoryMonth').value : '';
    const todayStr = new Date().toLocaleDateString('en-CA');

    let filtered = window.allTimeRecords.filter(r => { if(!monthFilterStr) return true; return r.workDate.startsWith(monthFilterStr); });
    let sumW = 0, sumO = 0;
    filtered.forEach(r => { sumW += parseFloat(r.workHours || 0); sumO += parseFloat(r.otHours || 0); });
    if(document.getElementById('sumWorkHr')) document.getElementById('sumWorkHr').innerText = sumW.toFixed(2);
    if(document.getElementById('sumOtHr')) document.getElementById('sumOtHr').innerText = sumO.toFixed(2);

    const totalRows = filtered.length; const totalPages = Math.ceil(totalRows / window.rowsPerPage) || 1;
    if(window.currentTimePage < 1) window.currentTimePage = 1; if(window.currentTimePage > totalPages) window.currentTimePage = totalPages;
    const startIdx = (window.currentTimePage - 1) * window.rowsPerPage; const endIdx = startIdx + window.rowsPerPage;
    const paginated = filtered.slice(startIdx, endIdx);

    if(document.getElementById('timePageInfo')) {
        const startText = totalRows > 0 ? startIdx + 1 : 0;
        const endText = Math.min(endIdx, totalRows);
        document.getElementById('timePageInfo').innerHTML = `<span class="fw-bold text-dark">${startText}-${endText}</span> จาก <span class="fw-bold text-dark">${totalRows}</span> รายการ`;
    }
    if(document.getElementById('btnPrevTime')) document.getElementById('btnPrevTime').disabled = window.currentTimePage === 1;
    if(document.getElementById('btnNextTime')) document.getElementById('btnNextTime').disabled = window.currentTimePage === totalPages;

    tbody.innerHTML = '';
    
    if (paginated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted py-4">ไม่พบประวัติการลงเวลา</td></tr>';
        return;
    }

    paginated.forEach(r => {
        const wHr = r.workHours ? parseFloat(r.workHours).toFixed(2) : '0.00';
        const oHr = r.otHours ? parseFloat(r.otHours).toFixed(2) : '0.00';
        
        let tOut = r.timeOut;
        let statusBadge = r.status === 'Completed' ? '<span class="badge bg-success-subtle text-success">เสร็จสิ้น</span>' : '<span class="badge bg-warning-subtle text-warning">กำลังทำงาน</span>';
        let isMissing = false;
        
        if(!r.timeOut && r.workDate < todayStr) {
            tOut = '<span class="text-danger fw-bold">ลืมลงเวลาออก</span>'; statusBadge = '<span class="badge bg-danger-subtle text-danger">ผิดปกติ</span>'; isMissing = true;
        } else if (!r.timeOut) { tOut = '<span class="text-warning small">ยังไม่ออกงาน</span>'; }

        let tInClass = 'text-success fw-medium'; if(r.timeIn && r.timeIn > '08:30') tInClass = 'text-danger fw-bold'; 
        const auditIcon = r.isCorrected ? ' <i class="bi bi-info-circle-fill text-primary" title="แก้ไขเวลาโดยผู้จัดการแล้ว"></i>' : '';

        let actionBtns = `<button class="btn btn-sm btn-outline-info me-1" onclick="window.viewWorkDetails('${r.id}')" title="ดูรายละเอียดงาน"><i class="bi bi-search"></i></button>`;
        if (r.correctionReq && r.correctionReq.status === 'รอพิจารณา') { actionBtns += `<span class="badge bg-warning-subtle text-warning ms-1">รออนุมัติแก้เวลา</span>`; } 
        else { const safeOut = r.timeOut ? r.timeOut : ''; actionBtns += `<button class="btn btn-sm btn-outline-danger" onclick="window.requestTimeCorrection('${r.id}', '${r.workDate}', '${r.timeIn||''}', '${safeOut}')" title="ขอแก้ไขเวลา"><i class="bi bi-pencil-square"></i></button>`; }

        tbody.innerHTML += `<tr><td>${r.workDate}</td><td>${r.location || '-'}${auditIcon}</td><td class="${tInClass}">${r.timeIn || '-'}</td><td class="fw-medium">${tOut}</td><td class="fw-bold">${wHr}</td><td class="fw-bold text-primary">${oHr}</td><td>${statusBadge}</td><td>${actionBtns}</td></tr>`;
    });
};

window.changeTimePage = (step) => { window.currentTimePage += step; window.renderTimeHistoryPage(); };

// ==========================================
// Export CSV
// ==========================================
window.exportTimesheet = () => {
    window.showSwal('กำลังเตรียมไฟล์', 'ระบบกำลังสร้างและรวบรวมข้อมูลเป็นไฟล์ CSV...', 'info');
    setTimeout(() => {
        const monthFilterStr = document.getElementById('timeHistoryMonth') ? document.getElementById('timeHistoryMonth').value : '';
        let exportData = window.allTimeRecords;
        if (monthFilterStr) exportData = window.allTimeRecords.filter(r => r.workDate.startsWith(monthFilterStr));
        if (exportData.length === 0) return window.showSwal('ไม่พบข้อมูล', 'ไม่มีประวัติการลงเวลาในเดือนที่เลือก', 'warning');

        let csvContent = "\uFEFF"; 
        csvContent += "วันที่,สถานที่,เวลาเข้างาน,เวลาออกงาน,ชั่วโมงทำงานปกติ,OT (ชม.),สถานะ,รายละเอียดงาน\n";

        exportData.forEach(r => {
            const wHr = r.workHours ? parseFloat(r.workHours).toFixed(2) : '0.00';
            const oHr = r.otHours ? parseFloat(r.otHours).toFixed(2) : '0.00';
            const tIn = r.timeIn || '-';
            const tOut = r.timeOut || 'ยังไม่ออกงาน';
            const loc = r.location ? `"${r.location.replace(/"/g, '""')}"` : '-';
            const det = r.details ? `"${r.details.replace(/"/g, '""')}"` : '-'; 
            let statusStr = 'กำลังทำงาน';
            if(r.status === 'Completed') statusStr = 'เสร็จสิ้น';
            if(!r.timeOut && r.workDate < new Date().toLocaleDateString('en-CA')) statusStr = 'ลืมลงเวลาออก';

            csvContent += `${r.workDate},${loc},${tIn},${tOut},${wHr},${oHr},${statusStr},${det}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url); link.setAttribute("download", monthFilterStr ? `Timesheet_${currentUser.uid}_${monthFilterStr}.csv` : `Timesheet_${currentUser.uid}_All.csv`);
        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.showSwal('ดาวน์โหลดสำเร็จ', 'ไฟล์ถูกดาวน์โหลดแล้ว', 'success');
    }, 800);
};

window.exportAdminLeaveReport = () => {
    window.showSwal('กำลังเตรียมไฟล์', 'ระบบกำลังสร้างไฟล์ Report CSV...', 'info');
    setTimeout(() => {
        const filterStatus = document.getElementById('adminFilterStatus') ? document.getElementById('adminFilterStatus').value : 'all';
        let exportData = window.allLeaves;
        if (filterStatus !== 'all') exportData = window.allLeaves.filter(l => l.status === filterStatus);
        if (!exportData || exportData.length === 0) return window.showSwal('ไม่พบข้อมูล', 'ไม่มีประวัติการลาในระบบ', 'warning');

        let csvContent = "\uFEFF"; 
        csvContent += "รหัสพนักงาน,ชื่อ-นามสกุล,วันที่ยื่น,เริ่มวันที่,ถึงวันที่,จำนวนวัน,ประเภทการลา,เหตุผล,สถานะ\n";

        exportData.forEach(l => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID);
            const empName = u ? `${u.Name} ${u.SurName || ''}` : 'ไม่ทราบชื่อ';
            const dStart = l.startDate || l.date || '-';
            const dEnd = l.endDate && l.endDate !== dStart ? l.endDate : dStart;
            const type = leaveTypesTH[l.type] || l.type;
            const reason = l.reason ? `"${l.reason.replace(/"/g, '""')}"` : '-';
            csvContent += `="${l.empID}",${empName},${l.submittedDate || '-'},${dStart},${dEnd},${l.days || 1},${type},${reason},${l.status}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url); link.setAttribute("download", `Leave_Report_${Date.now()}.csv`);
        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.showSwal('ดาวน์โหลดสำเร็จ', 'ไฟล์ถูกดาวน์โหลดเรียบร้อยแล้ว', 'success');
    }, 800);
};

window.exportAdminEmployees = () => {
    window.showSwal('กำลังเตรียมไฟล์', 'ระบบกำลังสร้างไฟล์รายชื่อพนักงาน CSV...', 'info');
    setTimeout(() => {
        if (!window.allUsers || window.allUsers.length === 0) return window.showSwal('ไม่พบข้อมูล', 'ไม่มีพนักงานในระบบ', 'warning');

        let csvContent = "\uFEFF"; 
        csvContent += "รหัสพนักงาน,เลขบัตรประชาชน,ชื่อ-นามสกุล,ระดับสิทธิ์,วันลาป่วย(เหลือ),ลากิจ(เหลือ),พักร้อน(เหลือ)\n";

        window.allUsers.forEach(u => {
            const safeUid = u.uid || u.docId;
            const idCard = u.idCard ? `="${u.idCard}"` : '-';
            const empName = `${u.Name || '-'} ${u.SurName || ''}`;
            const role = u.role === 'admin' ? 'Admin' : (u.role === 'leader' ? 'Manager' : 'Staff');
            const bal = u.leaveBalances || { sick: 0, personal: 0, annual: 0 };
            csvContent += `="${safeUid}",${idCard},${empName},${role},${bal.sick || 0},${bal.personal || 0},${bal.annual || 0}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url); link.setAttribute("download", `Employee_List_${Date.now()}.csv`);
        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.showSwal('ดาวน์โหลดสำเร็จ', 'ไฟล์ถูกดาวน์โหลดเรียบร้อยแล้ว', 'success');
    }, 800);
};

window.viewWorkDetails = (id) => {
    const r = window.allTimeRecords.find(x => x.id === id); if(!r) return;
    Swal.fire({ title: `รายละเอียดงาน<br><span class="fs-6 text-muted">${r.workDate}</span>`, html: `<div class="text-start bg-light p-3 rounded border"><b>สถานที่:</b> <span class="text-primary">${r.location}</span><br><b>เวลาทำงาน:</b> ${r.timeIn} - ${r.timeOut || 'ยังไม่ออกงาน'}<br><hr><b>เนื้องานที่บันทึก:</b><br>${r.details || '<span class="text-muted">ไม่มีรายละเอียด</span>'}</div>`, confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#2563eb' });
};

window.requestTimeCorrection = (id, date, curIn, curOut) => {
    Swal.fire({
        title: 'ยื่นคำร้องขอแก้ไขเวลา',
        html: `<div class="text-start"><p class="text-muted small mb-3">วันที่: ${date}</p><label class="form-label small fw-bold">เวลาเข้างาน</label><input type="time" id="reqTimeIn" class="form-control mb-3" value="${curIn}"><label class="form-label small fw-bold">เวลาออกงาน</label><input type="time" id="reqTimeOut" class="form-control mb-3" value="${curOut}"><label class="form-label small fw-bold">เหตุผลการขอแก้ไข <span class="text-danger">*</span></label><input type="text" id="reqReason" class="form-control" placeholder="เช่น ลืมสแกนนิ้ว, ระบบค้าง..." required></div>`,
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
        const tIn = new Date(`${data.workDate}T${req.timeIn}`); const tOut = new Date(`${data.workDate}T${req.timeOut}`);
        let diffHrs = (tOut - tIn) / 3600000; if(tIn.getHours() <= 12 && tOut.getHours() >= 13) diffHrs -= 1;
        diffHrs = Math.max(0, diffHrs); let normalHrs = Math.min(8, diffHrs); let rawOt = Math.max(0, diffHrs - 8); let otHrs = Math.floor(rawOt * 2) / 2;
        await updateDoc(docRef, { timeIn: req.timeIn, timeOut: req.timeOut, workHours: parseFloat(normalHrs.toFixed(2)), otHours: parseFloat(otHrs.toFixed(2)), isCorrected: true, status: "Completed", correctionReq: null });
        window.showSwal('อนุมัติสำเร็จ', 'อัปเดตเวลาให้พนักงานเรียบร้อยแล้ว', 'success');
    } else {
        await updateDoc(docRef, { correctionReq: null }); window.showSwal('ปฏิเสธคำร้อง', 'ยกเลิกคำขอแก้ไขเวลาแล้ว', 'info');
    }
    refreshUI();
};

const refreshUI = async () => {
    if(!checkAuthStatus(currentUser ? currentUser.role : 'login')) return;
    try {
        if (currentUser.role === 'employee' && typeof renderEmployeeUI === 'function') await window.renderEmployeeUI();
        if (currentUser.role === 'leader' && typeof renderManagerUI === 'function') await window.renderManagerUI();
        if (currentUser.role === 'admin' && typeof renderAdminUI === 'function') await window.renderAdminUI();
    } catch (err) {
        console.error("Rendering Error: ", err);
    }
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
        empTbody.innerHTML += `<tr><td>${index+1}</td><td><span class="fw-bold text-primary">${safeUid}</span></td><td><span class="text-muted">${u.idCard || '-'}</span></td><td><span class="fw-medium">${u.Name || '-'} ${u.SurName || ''}</span></td><td>${getRoleBadge(u.role)}</td><td><div class="d-flex justify-content-center gap-2"><button class="btn btn-sm btn-outline-secondary" onclick="window.openEditEmployeeModal('${safeUid}')"><i class="bi bi-pencil"></i> แก้ไข</button><button class="btn btn-sm btn-outline-danger" onclick="window.deleteEmployee('${safeUid}')"><i class="bi bi-trash"></i> ลบ</button></div></td></tr>`;
        if(leaveBalTbody) {
            const bal = u.leaveBalances || { sick: 0, personal: 0, annual: 0, maternity: 0, ordination: 0, military: 0 };
            leaveBalTbody.innerHTML += `<tr><td>${index+1}</td><td><span class="fw-bold text-dark">${safeUid}</span></td><td><span class="fw-medium">${u.Name || '-'} ${u.SurName || ''}</span></td><td class="text-primary fw-bold">${bal.sick || 0}</td><td class="text-primary fw-bold">${bal.personal || 0}</td><td class="text-primary fw-bold">${bal.annual || 0}</td><td class="text-secondary">${bal.maternity || 0}</td><td class="text-secondary">${bal.ordination || 0}</td><td class="text-secondary">${bal.military || 0}</td><td><button class="btn btn-sm btn-outline-primary" onclick="window.openEditLeaveBalanceModal('${safeUid}')"><i class="bi bi-sliders"></i> ปรับสิทธิ์</button></td></tr>`;
        }
    });

    const filterStatus = document.getElementById('adminFilterStatus') ? document.getElementById('adminFilterStatus').value : 'all';
    const reportTbody = document.getElementById('adminReportTableBody');
    if(reportTbody) {
        reportTbody.innerHTML = ''; let no = 1;
        window.allLeaves.forEach(l => {
            if(filterStatus !== 'all' && l.status !== filterStatus) return;
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); 
            const certBadge = l.certUrl ? `<button type="button" class="btn btn-sm btn-outline-primary py-0 rounded-pill" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-paperclip me-1"></i>ดูรูป</button>` : (l.hasCert ? '<i class="bi bi-check-circle-fill text-success"></i>' : '-');
            const dStart = l.startDate || l.date || '-'; const dEnd = (l.endDate && l.endDate !== dStart && l.startDate) ? `<br>ถึง ${l.endDate}` : '';
            reportTbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium text-primary">${l.empID}</span></td><td>${u ? u.Name : '-'}</td><td>${l.submittedDate || '-'}</td><td>${dStart}${dEnd}</td><td>${leaveTypesTH[l.type]}</td><td>${certBadge}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info" onclick="window.viewLeaveDetail('${l.id}')"><i class="bi bi-search"></i></button></td></tr>`;
        });
    }

    const approveTbody = document.getElementById('adminApproveManagerTableBody');
    if(approveTbody) {
        approveTbody.innerHTML = ''; let no = 1;
        window.allLeaves.filter(l => (l.status === 'รอพิจารณา' || l.status === 'ขอยกเลิก') && window.allUsers.find(x => (x.uid || x.docId) === l.empID)?.role === 'leader').forEach(l => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); const lDays = l.days || 1; const dStart = l.startDate || l.date || '-'; const dEnd = (l.endDate && l.endDate !== dStart && l.startDate) ? ` - ${l.endDate}` : '';
            let btnHTML = '-';
            if (l.status === 'รอพิจารณา') { btnHTML = `<button class="btn btn-sm btn-primary me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}', ${lDays}, 'รอพิจารณา')">อนุมัติ</button><button class="btn btn-sm btn-outline-danger me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','ไม่อนุมัติ','${l.empID}','${l.type}', 0, 'รอพิจารณา')">ไม่อนุมัติ</button>`; } 
            else if (l.status === 'ขอยกเลิก') { btnHTML = `<button class="btn btn-sm btn-danger me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','ยกเลิก','${l.empID}','${l.type}', ${lDays}, 'ขอยกเลิก')">อนุมัติยกเลิก</button><button class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}', 0, 'ขอยกเลิก')">ปฏิเสธ</button>`; }
            
            const certBadge = l.certUrl ? `<button type="button" class="btn btn-sm btn-outline-primary py-0 rounded-pill" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-paperclip me-1"></i>ดูรูป</button>` : (l.hasCert ? '<i class="bi bi-check-circle-fill text-success"></i>' : '-');
            
            approveTbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${l.submittedDate || '-'}</td><td>${dStart}${dEnd}</td><td>${leaveTypesTH[l.type]}</td><td>${certBadge}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info me-1 mb-1" onclick="window.viewLeaveDetail('${l.id}')">ดูรายละเอียด</button>${btnHTML}</td></tr>`;
        });
    }

    const adminTimeTbody = document.getElementById('adminApproveTimeTableBody');
    if(adminTimeTbody) {
        adminTimeTbody.innerHTML = '';
        const adminTimeReqs = allWork.filter(w => w.correctionReq && w.correctionReq.status === 'รอพิจารณา' && window.allUsers.find(u => (u.uid || u.docId) === w.empID)?.role === 'leader');
        adminTimeReqs.forEach(r => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === r.empID); const curTime = `${r.timeIn||'-'} - ${r.timeOut||'-'}`; const reqTime = `<span class="text-primary fw-bold">${r.correctionReq.timeIn} - ${r.correctionReq.timeOut}</span>`;
            adminTimeTbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${r.workDate}</td><td>${curTime}</td><td>${reqTime}</td><td>${r.correctionReq.reason}</td><td><button class="btn btn-sm btn-primary me-1" onclick="window.approveTimeCorrection('${r.id}', true)">อนุมัติ</button><button class="btn btn-sm btn-outline-danger" onclick="window.approveTimeCorrection('${r.id}', false)">ไม่อนุมัติ</button></td></tr>`;
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
            const u = window.allUsers.find(x => (x.uid || x.docId) === l.empID); const lDays = l.days || 1; const dStart = l.startDate || l.date || '-'; const dEnd = (l.endDate && l.endDate !== dStart && l.startDate) ? ` - ${l.endDate}` : '';
            let btnHTML = '-';
            if (l.status === 'รอพิจารณา') { btnHTML = `<button class="btn btn-sm btn-primary me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}', ${lDays}, 'รอพิจารณา')">อนุมัติ</button><button class="btn btn-sm btn-outline-danger me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','ไม่อนุมัติ','${l.empID}','${l.type}', 0, 'รอพิจารณา')">ไม่อนุมัติ</button>`; } 
            else if (l.status === 'ขอยกเลิก') { btnHTML = `<button class="btn btn-sm btn-danger me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','ยกเลิก','${l.empID}','${l.type}', ${lDays}, 'ขอยกเลิก')">อนุมัติยกเลิก</button><button class="btn btn-sm btn-outline-secondary me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}', 0, 'ขอยกเลิก')">ปฏิเสธ</button>`; }
            
            const certBadge = l.certUrl ? `<button type="button" class="btn btn-sm btn-outline-primary py-0 rounded-pill" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-paperclip me-1"></i>ดูรูป</button>` : (l.hasCert ? '<i class="bi bi-check-circle-fill text-success"></i>' : '-');
            
            tbody.innerHTML += `<tr><td>${no++}</td><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${l.submittedDate || '-'}</td><td>${dStart}${dEnd}</td><td>${leaveTypesTH[l.type]}</td><td>${certBadge}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info me-1 mb-1" onclick="window.viewLeaveDetail('${l.id}')">ดู</button> ${btnHTML}</td></tr>`;
        });
    }

    const mgrTimeTbody = document.getElementById('managerApproveTimeTableBody');
    if(mgrTimeTbody) {
        mgrTimeTbody.innerHTML = '';
        const mgrTimeReqs = allWork.filter(w => w.correctionReq && w.correctionReq.status === 'รอพิจารณา' && window.allUsers.find(u => (u.uid || u.docId) === w.empID)?.role === 'employee');
        mgrTimeReqs.forEach(r => {
            const u = window.allUsers.find(x => (x.uid || x.docId) === r.empID); const curTime = `${r.timeIn||'-'} - ${r.timeOut||'-'}`; const reqTime = `<span class="text-primary fw-bold">${r.correctionReq.timeIn} - ${r.correctionReq.timeOut}</span>`;
            mgrTimeTbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${r.workDate}</td><td>${curTime}</td><td>${reqTime}</td><td>${r.correctionReq.reason}</td><td><button class="btn btn-sm btn-primary me-1 mb-1" onclick="window.approveTimeCorrection('${r.id}', true)">อนุมัติ</button><button class="btn btn-sm btn-outline-danger me-1 mb-1" onclick="window.approveTimeCorrection('${r.id}', false)">ไม่อนุมัติ</button></td></tr>`;
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
        const total = currentUser.leaveTotal || { sick: 30, personal: 3, annual: 6 }; 
        const balances = currentUser.leaveBalances || { sick: 30, personal: 3, annual: 6 };
        
        document.getElementById('statPersBal').innerText = balances.personal || 0; 
        document.getElementById('statPersUsed').innerText = Math.max(0, (total.personal - (balances.personal || 0))).toFixed(1);
        document.getElementById('statSickBal').innerText = balances.sick || 0; 
        document.getElementById('statSickUsed').innerText = Math.max(0, (total.sick - (balances.sick || 0)));
        document.getElementById('statAnnBal').innerText = balances.annual || 0; 
        document.getElementById('statAnnUsed').innerText = Math.max(0, (total.annual - (balances.annual || 0)));

        if(document.getElementById('barPers')) document.getElementById('barPers').style.width = `${Math.min(100, ((total.personal - (balances.personal||0)) / total.personal) * 100)}%`;
        if(document.getElementById('barSick')) document.getElementById('barSick').style.width = `${Math.min(100, ((total.sick - (balances.sick||0)) / total.sick) * 100)}%`;
        if(document.getElementById('barAnn')) document.getElementById('barAnn').style.width = `${Math.min(100, ((total.annual - (balances.annual||0)) / total.annual) * 100)}%`;
    }

    const leavesSnap = await getDocs(query(collection(db, "leaves"), where("empID", "==", currentUser.uid)));
    window.allLeaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.allLeaves.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 

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
            
            const certBadge = l.certUrl ? `<button type="button" class="btn btn-sm btn-outline-primary py-0 rounded-pill" onclick="window.previewCertImage('${l.id}')"><i class="bi bi-paperclip me-1"></i>ดูรูป</button>` : (l.hasCert ? '<i class="bi bi-check-circle-fill text-success"></i>' : '-');
            const dStart = l.startDate || l.date || '-'; 
            const dEnd = (l.endDate && l.endDate !== dStart && l.startDate) ? ` - ${l.endDate}` : '';
            
            lTbody.innerHTML += `<tr><td>${no++}</td><td>${l.submittedDate || '-'}</td><td>${dStart}${dEnd}</td><td>${leaveTypesTH[l.type]}</td><td>${certBadge}</td><td>${getStatusBadge(l.status)}</td><td><button class="btn btn-sm btn-outline-info me-1" onclick="window.viewLeaveDetail('${l.id}')">ดู</button> ${cancelBtn}</td></tr>`;
        });
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    if(document.getElementById('empCurrentDateDisplay')) document.getElementById('empCurrentDateDisplay').innerText = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const timeSnap = await getDocs(query(collection(db, "workRecords"), where("empID", "==", currentUser.uid)));
    window.allTimeRecords = timeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })); window.allTimeRecords.sort((a, b) => new Date(b.workDate) - new Date(a.workDate)); 
    if(document.getElementById('timeHistoryMonth') && !document.getElementById('timeHistoryMonth').value) { document.getElementById('timeHistoryMonth').value = todayStr.slice(0, 7); }
    window.renderTimeHistoryPage(1);

    const todayRecord = window.allTimeRecords.find(r => r.workDate === todayStr);
    const btnStamp = document.getElementById('btnStampTime');
    if (todayRecord) {
        document.getElementById('displayCheckIn').innerText = todayRecord.timeIn || '-'; document.getElementById('displayCheckOut').innerText = todayRecord.timeOut || '-';
        document.getElementById('displayWorkHr').innerText = todayRecord.workHours ? parseFloat(todayRecord.workHours).toFixed(2) : '0.00'; document.getElementById('displayOtHr').innerText = todayRecord.otHours ? parseFloat(todayRecord.otHours).toFixed(2) : '0.00';
        document.getElementById('workLocation').value = todayRecord.location || ''; document.getElementById('workDetails').value = todayRecord.details || '';
        if (!todayRecord.timeOut) { btnStamp.disabled = false; btnStamp.className = "btn btn-danger btn-lg w-100 rounded-pill shadow-sm py-3 fw-bold"; btnStamp.innerHTML = 'แสตมป์ออกงาน'; } 
        else { btnStamp.disabled = true; btnStamp.className = "btn btn-outline-secondary btn-lg w-100 rounded-pill py-3 fw-bold"; btnStamp.innerHTML = 'บันทึกเวลาครบแล้ว'; }
    } else {
        document.getElementById('displayCheckIn').innerText = '-'; document.getElementById('displayCheckOut').innerText = '-';
        document.getElementById('displayWorkHr').innerText = '0.00'; document.getElementById('displayOtHr').innerText = '0.00';
        document.getElementById('workLocation').value = ''; document.getElementById('workDetails').value = '';
        btnStamp.disabled = false; btnStamp.className = "btn btn-primary btn-lg w-100 rounded-pill shadow-sm py-3 fw-bold"; btnStamp.innerHTML = 'แสตมป์เข้างาน';
    }
};

setInterval(() => { if(document.getElementById('empCurrentTime')) document.getElementById('empCurrentTime').innerText = new Date().toLocaleTimeString('th-TH'); }, 1000);

if(window.location.pathname.includes('employee.html')) { window.checkAuthStatus('employee'); refreshUI(); }
if(window.location.pathname.includes('manager.html')) { window.checkAuthStatus('leader'); refreshUI(); }
if(window.location.pathname.includes('admin.html')) { window.checkAuthStatus('admin'); refreshUI(); }
if(window.location.pathname.includes('index.html') || window.location.pathname === '/') { window.checkAuthStatus('login'); }