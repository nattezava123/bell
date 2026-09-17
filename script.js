import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. Firebase Configuration
// ==========================================
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

// ==========================================
// 2. Global State & Helpers
// ==========================================
let currentUser = JSON.parse(sessionStorage.getItem('hr_currentUser'));
const leaveTypesTH = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน' };

window.showSwal = (title, text, icon = 'success') => {
    if (typeof Swal !== 'undefined') {
        Swal.fire({ title, text, icon, confirmButtonText: 'ตกลง', confirmButtonColor: '#2563eb', timer: icon === 'success' ? 2500 : undefined, customClass: { popup: 'rounded-4' } });
    } else { alert(`${title}\n${text}`); }
};

window.navigate = (sectionId) => {
    document.querySelectorAll('.spa-section').forEach(el => el.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
};

const getStatusBadge = (status) => {
    const badges = { 'อนุมัติ': '<span class="badge bg-success-subtle text-success">อนุมัติ</span>', 'ไม่อนุมัติ': '<span class="badge bg-danger-subtle text-danger">ไม่อนุมัติ</span>', 'ยกเลิก': '<span class="badge bg-secondary-subtle text-secondary">ยกเลิกแล้ว</span>' };
    return badges[status] || '<span class="badge bg-warning-subtle text-warning">รอพิจารณา</span>';
};

const getRoleBadge = (role) => {
    const badges = { 'admin': '<span class="badge bg-dark-subtle text-dark">Admin</span>', 'leader': '<span class="badge bg-primary-subtle text-primary">Manager</span>' };
    return badges[role] || '<span class="badge bg-info-subtle text-info">Employee</span>';
};

// ==========================================
// 3. Authentication Rules
// ==========================================
window.checkAuthStatus = (reqRole) => {
    if (!currentUser && reqRole !== 'login') window.location.href = 'index.html'; 
    if (currentUser && reqRole === 'login') window.location.href = currentUser.role === 'leader' ? 'manager.html' : `${currentUser.role}.html`;
    
    if (currentUser && document.getElementById('navUserInfo')) {
        document.getElementById('navUserInfo').innerText = `${currentUser.Name} ${currentUser.SurName || ''} (${currentUser.role.toUpperCase()})`;
    }
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
        } else {
            window.showSwal('เข้าสู่ระบบไม่สำเร็จ', 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error');
        }
    } catch (error) {
        window.showSwal('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    }
};

window.logout = () => {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ออกจากระบบ', cancelButtonText: 'ยกเลิก' })
    .then((result) => { if (result.isConfirmed) { sessionStorage.removeItem('hr_currentUser'); window.location.href = 'index.html'; } });
};

// ==========================================
// 4. Work Records (ลงเวลา)
// ==========================================
window.handleStampTime = async () => {
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    if(!loc || !det.trim()) return window.showSwal('ข้อมูลไม่ครบ', 'กรุณาระบุสถานที่และรายละเอียดงาน', 'warning');

    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentTime = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' });
    const recordsRef = collection(db, "workRecords");
    
    const q = query(recordsRef, where("empID", "==", currentUser.uid), where("workDate", "==", todayStr));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        await addDoc(recordsRef, { empID: currentUser.uid, timestamp: new Date(), workDate: todayStr, timeIn: currentTime, timeOut: "", workHours: 0.0, otHours: 0.0, details: det, location: loc, status: "Working" });
        window.showSwal('CHECK-IN สำเร็จ', `เข้างานเวลา: ${currentTime} น.`, 'success');
        refreshUI();
    } else {
        const recordDoc = snapshot.docs[0];
        const recordData = recordDoc.data();
        if (recordData.timeOut) return window.showSwal('สำเร็จแล้ว', 'คุณได้บันทึกเวลาออกงานไปแล้ว', 'info');

        const diffMs = new Date(0,0,0,...currentTime.split(':')) - new Date(0,0,0,...recordData.timeIn.split(':'));
        if (diffMs < 60000) return window.showSwal('เตือนการกดซ้ำ', 'เพิ่งเข้างาน กรุณารออย่างน้อย 1 นาที', 'warning');

        Swal.fire({ title: 'ยืนยัน CHECK-OUT?', icon: 'question', showCancelButton: true, confirmButtonColor: '#2563eb', confirmButtonText: 'ออกงาน', cancelButtonText: 'ยกเลิก' })
        .then(async (result) => { 
            if (result.isConfirmed) {
                let totalHrs = Math.max(0, diffMs / 3600000);
                const normalHrs = Math.min(8, totalHrs).toFixed(2);
                const otHrs = Math.max(0, totalHrs - 8).toFixed(2);
                
                await updateDoc(doc(db, "workRecords", recordDoc.id), { timeOut: currentTime, workHours: parseFloat(normalHrs), otHours: parseFloat(otHrs), details: det, location: loc, status: "Completed" });
                window.showSwal('CHECK-OUT สำเร็จ', `ชั่วโมงทำงาน: ${normalHrs} ชม.`, 'success');
                refreshUI();
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

    if (!snapshot.empty) {
        await updateDoc(doc(db, "workRecords", snapshot.docs[0].id), { location: loc, details: det });
        window.showSwal('บันทึกสำเร็จ', 'อัปเดตรายละเอียดงานเรียบร้อย', 'success');
    } else { window.showSwal('ข้อผิดพลาด', 'กรุณา CHECK-IN ก่อนบันทึกรายละเอียด', 'error'); }
};

// ==========================================
// 5. Leave Management
// ==========================================
window.handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const date = document.getElementById('leaveDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if(!type) return window.showSwal('ข้อมูลไม่ครบ', 'เลือกประเภทการลา', 'warning');
    if(currentUser.leaveBalances[type] <= 0) return window.showSwal('สิทธิหมด', `สิทธิ ${leaveTypesTH[type]} หมดแล้ว`, 'error');

    await addDoc(collection(db, "leaves"), { empID: currentUser.uid, type, date, reason, status: 'รอพิจารณา', timestamp: new Date() });
    
    document.getElementById('leaveType').value = ''; document.getElementById('leaveDate').value = ''; document.getElementById('leaveReason').value = '';
    window.showSwal('ยื่นคำขอสำเร็จ', 'ระบบได้รับคำขอแล้ว', 'success'); 
    refreshUI();
};

window.cancelMyLeave = (leaveId) => {
    Swal.fire({ title: 'ยกเลิกคำขอ?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ยกเลิกคำขอ' }).then(async (result) => {
        if (result.isConfirmed) {
            await updateDoc(doc(db, "leaves", leaveId), { status: 'ยกเลิก' });
            window.showSwal('ยกเลิกสำเร็จ', '', 'success'); refreshUI();
        }
    });
};

window.updateLeaveStatus = async (leaveId, status, empID, type) => {
    await updateDoc(doc(db, "leaves", leaveId), { status: status });
    if(status === 'อนุมัติ') {
        const userDocRef = doc(db, "users", empID);
        const userSnap = await getDoc(userDocRef);
        if(userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.leaveBalances && userData.leaveBalances[type] > 0) {
                userData.leaveBalances[type] -= 1;
                await updateDoc(userDocRef, { leaveBalances: userData.leaveBalances });
            }
        }
    }
    window.showSwal('บันทึกสำเร็จ', `สถานะ: ${status}`, status === 'อนุมัติ' ? 'success' : 'info'); 
    refreshUI();
};

// ==========================================
// 6. Admin User Management (เพิ่ม/ลบ/แก้ไข)
// ==========================================
window.handleAddEmployee = async (e) => {
    e.preventDefault();
    const newId = document.getElementById('regId').value;
    const idCard = document.getElementById('regIdCard').value;
    
    const docSnap = await getDoc(doc(db, "users", newId));
    if(docSnap.exists()) return window.showSwal('ผิดพลาด', 'รหัสพนักงานซ้ำ', 'error');
    
    const autoPassword = idCard.slice(-4); 

    await setDoc(doc(db, "users", newId), { 
        uid: newId, idCard: idCard, password: autoPassword, Name: document.getElementById('regName').value, 
        SurName: '', role: document.getElementById('regRole').value, 
        leaveBalances: { sick: 30, personal: 3, annual: 6 }, leaveTotal: { sick: 30, personal: 3, annual: 6 } 
    });
    
    document.getElementById('addEmployeeForm').reset(); 
    window.showSwal('สำเร็จ!', `สร้างบัญชีเรียบร้อย\nรหัสผ่านคือ: ${autoPassword}`, 'success');
    refreshUI();
};

window.deleteEmployee = (id) => { 
    if(id === 'admin') return window.showSwal('ปฏิเสธ', 'ไม่สามารถลบ Admin ได้', 'error'); 
    Swal.fire({ title: 'ยืนยันการลบ?', text: 'ข้อมูลจะถูกลบถาวร', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ลบข้อมูล' }).then(async (result) => {
        if(result.isConfirmed) { 
            await deleteDoc(doc(db, "users", id)); 
            refreshUI(); 
        }
    });
};

window.currentEditEmpId = null;

window.openEditEmployeeModal = async (uid) => {
    try {
        if (!uid || uid === 'undefined') {
            return window.showSwal('ข้อผิดพลาด', 'รหัสพนักงานไม่ถูกต้อง หรือไม่มีในระบบ', 'error');
        }

        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
            const u = userDoc.data();
            window.currentEditEmpId = uid;
            
            document.getElementById('editEmpIdDisplay').value = u.uid || uid;
            document.getElementById('editEmpIdCardInput').value = u.idCard || '';
            document.getElementById('editEmpNameInput').value = `${u.Name || ''} ${u.SurName || ''}`.trim();
            document.getElementById('editEmpRoleInput').value = u.role || 'employee';
            
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('editEmpModal'));
            modal.show();
        } else {
            window.showSwal('ข้อผิดพลาด', 'ไม่พบข้อมูลพนักงานคนนี้ในฐานข้อมูล', 'error');
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
        window.showSwal('ไม่สามารถเข้าถึงข้อมูลได้', error.message, 'error');
    }
};

window.saveEditEmployee = async () => {
    const uid = window.currentEditEmpId;
    if (!uid) return;
    
    const newIdCard = document.getElementById('editEmpIdCardInput').value.trim();
    const fullName = document.getElementById('editEmpNameInput').value.trim();
    const newRole = document.getElementById('editEmpRoleInput').value;
    
    if (!fullName) return window.showSwal('ข้อผิดพลาด', 'กรุณาระบุชื่อพนักงาน', 'warning');
    if (newIdCard && newIdCard.length !== 13) return window.showSwal('ข้อผิดพลาด', 'เลขบัตรประชาชนต้องมี 13 หลัก', 'warning');
    
    const nameParts = fullName.split(' ');
    const newName = nameParts[0];
    const newSurName = nameParts.slice(1).join(' ');

    const btn = document.getElementById('btnSaveEdit');
    if(btn) { btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...'; }

    try {
        await updateDoc(doc(db, "users", uid), {
            idCard: newIdCard,
            password: newIdCard ? newIdCard.slice(-4) : '1234',
            Name: newName,
            SurName: newSurName,
            role: newRole
        });
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editEmpModal'));
        if(modal) modal.hide();
        
        window.showSwal('สำเร็จ', 'อัปเดตข้อมูลพนักงานเรียบร้อย', 'success');
        refreshUI();
    } catch (error) {
        window.showSwal('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = 'บันทึกการเปลี่ยนแปลง'; }
    }
};

// ==========================================
// 7. UI Rendering
// ==========================================
const refreshUI = async () => {
    if (currentUser.role === 'employee' && typeof renderEmployeeUI === 'function') await window.renderEmployeeUI();
    if (currentUser.role === 'leader' && typeof renderManagerUI === 'function') await window.renderManagerUI();
    if (currentUser.role === 'admin' && typeof renderAdminUI === 'function') await window.renderAdminUI();
};

window.renderAdminUI = async () => {
    if(!document.getElementById('adminEmployeeTableBody')) return;
    
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    
    const leavesSnap = await getDocs(collection(db, "leaves"));
    const leaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const empTbody = document.getElementById('adminEmployeeTableBody');
    empTbody.innerHTML = '';
    
    users.forEach(u => {
        const safeUid = u.uid || u.docId; 
        
        // แก้ไข: เพิ่มคอลัมน์ idCard และใช้ d-flex gap-2 เพื่อจัดปุ่มให้สวยงาม
        empTbody.innerHTML += `<tr>
            <td><span class="fw-bold text-primary">${safeUid}</span></td>
            <td><span class="text-muted">${u.idCard || '-'}</span></td>
            <td><span class="fw-medium">${u.Name || '-'} ${u.SurName || ''}</span></td>
            <td>${getRoleBadge(u.role)}</td>
            <td>
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.openEditEmployeeModal('${safeUid}')"><i class="bi bi-pencil"></i> แก้ไข</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.deleteEmployee('${safeUid}')"><i class="bi bi-trash"></i> ลบ</button>
                </div>
            </td>
        </tr>`;
    });

    const approveTbody = document.getElementById('adminApproveManagerTableBody');
    if(approveTbody) {
        approveTbody.innerHTML = '';
        leaves.filter(l => users.find(x => (x.uid || x.docId) === l.empID)?.role === 'leader').forEach(l => {
            const u = users.find(x => (x.uid || x.docId) === l.empID);
            let btnHTML = l.status === 'รอพิจารณา' ? `<button class="btn btn-sm btn-primary me-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}')">อนุมัติ</button><button class="btn btn-sm btn-outline-danger" onclick="window.updateLeaveStatus('${l.id}','ไม่อนุมัติ','${l.empID}','${l.type}')">ไม่อนุมัติ</button>` : `-`;
            approveTbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${leaveTypesTH[l.type]}</td><td>${l.date}</td><td class="text-start">${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${btnHTML}</td></tr>`;
        });
    }

    const reportTbody = document.getElementById('adminReportTableBody');
    if(reportTbody) {
        reportTbody.innerHTML = '';
        leaves.forEach(l => {
            const u = users.find(x => (x.uid || x.docId) === l.empID);
            reportTbody.innerHTML += `<tr><td><span class="fw-medium text-primary">${l.empID}</span></td><td>${u ? u.Name : '-'}</td><td>${u ? getRoleBadge(u.role) : '-'}</td><td>${leaveTypesTH[l.type]}</td><td>${l.date}</td><td>${getStatusBadge(l.status)}</td></tr>`;
        });
    }
};

window.renderManagerUI = async () => {
    await window.renderEmployeeUI(); 
    
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    
    const leavesSnap = await getDocs(collection(db, "leaves"));
    const leaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tbody = document.getElementById('managerApprovalTableBody');
    if(tbody) {
        tbody.innerHTML = '';
        leaves.filter(l => users.find(u => (u.uid || u.docId) === l.empID)?.role === 'employee').forEach(l => {
            const u = users.find(x => (x.uid || x.docId) === l.empID);
            let btnHTML = l.status === 'รอพิจารณา' ? `<button class="btn btn-sm btn-primary me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','อนุมัติ','${l.empID}','${l.type}')">อนุมัติ</button><button class="btn btn-sm btn-outline-danger me-1 mb-1" onclick="window.updateLeaveStatus('${l.id}','ไม่อนุมัติ','${l.empID}','${l.type}')">ปฏิเสธ</button>` : `-`;
            tbody.innerHTML += `<tr><td><span class="fw-medium">${u ? u.Name : '-'}</span></td><td>${leaveTypesTH[l.type]}</td><td>${l.date}</td><td class="text-start">${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${btnHTML}</td></tr>`;
        });
    }
};

window.renderEmployeeUI = async () => {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if(userDoc.exists()) {
        currentUser = userDoc.data();
        currentUser.uid = currentUser.uid || userDoc.id;
    }

    ['Menu', 'Time'].forEach(s => { if(document.getElementById(`empProfileName${s}`)) document.getElementById(`empProfileName${s}`).innerText = `${currentUser.Name || ''} ${currentUser.SurName || ''}`.trim(); });
    if(document.getElementById('empProfileId')) document.getElementById('empProfileId').innerText = currentUser.uid;
    if(document.getElementById('empProfileRole')) document.getElementById('empProfileRole').innerText = currentUser.role === 'leader' ? 'Manager' : 'Staff';

    if(document.getElementById('statPersBal')) {
        const total = currentUser.leaveTotal || { sick: 30, personal: 3.5, annual: 6 };
        const balances = currentUser.leaveBalances || { sick: 30, personal: 3.5, annual: 6 };
        
        document.getElementById('statPersBal').innerText = balances.personal; 
        document.getElementById('statPersUsed').innerText = (total.personal - balances.personal).toFixed(1);
        
        document.getElementById('statSickBal').innerText = balances.sick; 
        document.getElementById('statSickUsed').innerText = total.sick - balances.sick;
        
        document.getElementById('statAnnBal').innerText = balances.annual; 
        document.getElementById('statAnnUsed').innerText = total.annual - balances.annual;
    }

    const leavesSnap = await getDocs(query(collection(db, "leaves"), where("empID", "==", currentUser.uid)));
    const leaves = leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lTbody = document.getElementById('myLeaveStatusTable');
    if(lTbody) {
        lTbody.innerHTML = '';
        leaves.forEach(l => {
            let cancelBtn = (l.status === 'รอพิจารณา') ? `<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="window.cancelMyLeave('${l.id}')">ยกเลิก</button>` : '-';
            lTbody.innerHTML += `<tr><td>${l.date}</td><td>${leaveTypesTH[l.type]}</td><td class="text-start">${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${cancelBtn}</td></tr>`;
        });
    }

    if(document.getElementById('empCurrentDateDisplay')) document.getElementById('empCurrentDateDisplay').innerText = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, "workRecords"), where("empID", "==", currentUser.uid), where("workDate", "==", todayStr));
    const snapshot = await getDocs(q);
    const btnStamp = document.getElementById('btnStampTime');

    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        document.getElementById('displayCheckIn').innerText = data.timeIn || '-';
        document.getElementById('displayCheckOut').innerText = data.timeOut || '-';
        document.getElementById('displayWorkHr').innerText = data.workHours ? data.workHours.toFixed(2) : '0.00';
        document.getElementById('displayOtHr').innerText = data.otHours ? data.otHours.toFixed(2) : '0.00';
        document.getElementById('workLocation').value = data.location || '';
        document.getElementById('workDetails').value = data.details || '';

        if (!data.timeOut) {
            btnStamp.disabled = false; btnStamp.className = "btn btn-danger btn-lg w-100 rounded-pill shadow-sm"; btnStamp.innerHTML = 'แสตมป์ออกงาน';
        } else {
            btnStamp.disabled = true; btnStamp.className = "btn btn-outline-secondary btn-lg w-100 rounded-pill"; btnStamp.innerHTML = 'บันทึกเวลาครบแล้ว';
        }
    } else {
        document.getElementById('displayCheckIn').innerText = '-'; document.getElementById('displayCheckOut').innerText = '-';
        document.getElementById('displayWorkHr').innerText = '0.00'; document.getElementById('displayOtHr').innerText = '0.00';
        document.getElementById('workLocation').value = ''; document.getElementById('workDetails').value = '';
        btnStamp.disabled = false; btnStamp.className = "btn btn-primary btn-lg w-100 rounded-pill shadow-sm"; btnStamp.innerHTML = 'แสตมป์เข้างาน';
    }
};

setInterval(() => { if(document.getElementById('empCurrentTime')) document.getElementById('empCurrentTime').innerText = new Date().toLocaleTimeString('th-TH'); }, 1000);

// Initialize Security & Routes
if(window.location.pathname.includes('employee.html')) { window.checkAuthStatus('employee'); refreshUI(); }
if(window.location.pathname.includes('manager.html')) { window.checkAuthStatus('leader'); refreshUI(); }
if(window.location.pathname.includes('admin.html')) { window.checkAuthStatus('admin'); refreshUI(); }
if(window.location.pathname.includes('index.html') || window.location.pathname === '/') { window.checkAuthStatus('login'); }