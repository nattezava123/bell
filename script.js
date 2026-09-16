// ==========================================
// 1. ระบบฐานข้อมูล (Version 13 - Enterprise & SPA)
// ==========================================
const initDB = () => {
    if (!localStorage.getItem('hr_users_v13')) {
        const users = [
            { id: 'admin', idCard: '0000000001234', pass: '1234', role: 'admin', name: 'ผู้ดูแลระบบ', leaveBalances: { sick: 0, personal: 0, annual: 0 }, leaveTotal: { sick: 0, personal: 0, annual: 0 } },
            { id: 'mgr01', idCard: '1111111111234', pass: '1234', role: 'manager', name: 'ผจก. สมศักดิ์', leaveBalances: { sick: 30, personal: 3, annual: 6 }, leaveTotal: { sick: 30, personal: 3, annual: 6 } },
            { id: 'emp01', idCard: '2222222221234', pass: '1234', role: 'employee', name: 'ปานระพีพรรณ ทิวบุญเลี้ยง', leaveBalances: { sick: 28, personal: 2.5, annual: 6 }, leaveTotal: { sick: 30, personal: 3.5, annual: 6 } }
        ];
        localStorage.setItem('hr_users_v13', JSON.stringify(users));
        localStorage.setItem('hr_leaves_v13', JSON.stringify([]));
        localStorage.setItem('hr_worklogs_v13', JSON.stringify([]));
    }
};

const getData = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setData = (key, data) => localStorage.setItem(key, JSON.stringify(data));
let currentUser = JSON.parse(localStorage.getItem('hr_currentUser_v13'));
const leaveTypesTH = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน' };

// ==========================================
// 2. UI Helpers & SweetAlert2 (พร้อมระบบสำรองกันพัง)
// ==========================================
const showSwal = (title, text, icon = 'success') => {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: title,
            text: text,
            icon: icon,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#3b82f6',
            timer: icon === 'success' ? 2500 : undefined,
            customClass: { popup: 'rounded-4' }
        });
    } else {
        alert(`${title}\n${text}`);
    }
};

const navigate = (sectionId) => {
    document.querySelectorAll('.spa-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');
};

const getStatusBadge = (status) => {
    switch(status) {
        case 'อนุมัติ': return '<span class="badge bg-success-subtle text-success px-3 py-2 rounded-pill shadow-sm">อนุมัติ</span>';
        case 'ไม่อนุมัติ': return '<span class="badge bg-danger-subtle text-danger px-3 py-2 rounded-pill shadow-sm">ไม่อนุมัติ</span>';
        case 'ยกเลิก': return '<span class="badge bg-secondary-subtle text-secondary px-3 py-2 rounded-pill shadow-sm">ยกเลิกแล้ว</span>';
        default: return '<span class="badge bg-warning-subtle text-warning px-3 py-2 rounded-pill shadow-sm">รอพิจารณา</span>';
    }
};

const getRoleBadge = (role) => {
    switch(role) {
        case 'admin': return '<span class="badge bg-dark-subtle text-dark px-3 py-2 rounded-pill">Admin</span>';
        case 'manager': return '<span class="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">Manager</span>';
        default: return '<span class="badge bg-info-subtle text-info px-3 py-2 rounded-pill">Employee</span>';
    }
};

// ==========================================
// 3. ระบบ Authentication (ตรวจสอบสิทธิ์)
// ==========================================
const checkAuth = (reqRole) => {
    initDB();
    if (!currentUser && reqRole !== 'login') window.location.href = 'index.html'; 
    else if (currentUser && reqRole === 'login') window.location.href = currentUser.role + '.html';
    else if (currentUser && reqRole !== 'login' && currentUser.role !== reqRole) window.location.href = 'index.html';
    
    if(document.getElementById('navUserInfo') && currentUser) 
        document.getElementById('navUserInfo').innerText = `${currentUser.name} (${currentUser.role})`;
};

const handleLogin = (e) => {
    e.preventDefault();
    const userInp = document.getElementById('loginUsername').value;
    const passInp = document.getElementById('loginPassword').value;
    const foundUser = getData('hr_users_v13').find(u => u.id === userInp && u.pass === passInp);
    
    if (foundUser) { 
        localStorage.setItem('hr_currentUser_v13', JSON.stringify(foundUser)); 
        window.location.reload(); 
    } else {
        showSwal('เข้าสู่ระบบไม่สำเร็จ', 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'error');
    }
};

const confirmLogout = () => {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการออกจากระบบ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ออกจากระบบ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('hr_currentUser_v13');
                window.location.href = 'index.html';
            }
        });
    } else {
        if (confirm('ยืนยันการออกจากระบบใช่หรือไม่?')) {
            localStorage.removeItem('hr_currentUser_v13');
            window.location.href = 'index.html';
        }
    }
};
const logout = () => confirmLogout();

// ==========================================
// 4. ระบบลงเวลาทำงาน (Time Attendance & Anti-Bounce)
// ==========================================
const handleStampTime = () => {
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;

    if(!loc || !det.trim()) {
        return showSwal('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุสถานที่และรายละเอียดงาน ก่อนกด STAMP', 'warning');
    }

    const logs = getData('hr_worklogs_v13');
    const todayStr = new Date().toLocaleDateString('en-CA');
    const logIndex = logs.findIndex(w => w.userId === currentUser.id && w.date === todayStr);
    const currentTime = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' });

    if(logIndex === -1) {
        // CHECK-IN
        logs.push({ userId: currentUser.id, date: todayStr, timeIn: currentTime, timeOut: null, normalHrs: null, otHrs: null, location: loc, details: det });
        setData('hr_worklogs_v13', logs); 
        showSwal('CHECK-IN สำเร็จ', `บันทึกเวลาเข้างาน: ${currentTime} น.`, 'success');
        if(currentUser.role === 'employee' && typeof renderEmployeeUI === 'function') renderEmployeeUI();
        if(currentUser.role === 'manager' && typeof renderManagerUI === 'function') renderManagerUI();
        
    } else if (!logs[logIndex].timeOut) {
        // CHECK-OUT (ป้องกันการกดซ้ำใน 1 นาที)
        const tIn = logs[logIndex].timeIn.split(':'); 
        const tOut = currentTime.split(':');
        const diffMs = new Date(0,0,0,tOut[0],tOut[1]) - new Date(0,0,0,tIn[0],tIn[1]);
        
        if (diffMs < 60000) { 
            return showSwal('ระวังการกดซ้ำ!', 'คุณเพิ่งลงเวลาเข้างานเมื่อสักครู่ กรุณารออย่างน้อย 1 นาที จึงจะสามารถกดออกงานได้', 'warning');
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'ยืนยัน CHECK-OUT?',
                text: "คุณต้องการบันทึกเวลาออกงานใช่หรือไม่?",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'ยืนยันออกงาน',
                cancelButtonText: 'ยกเลิก'
            }).then((result) => {
                if (result.isConfirmed) processClockOut(logs, logIndex, currentTime, loc, det, diffMs);
            });
        } else {
            if(confirm("คุณต้องการบันทึกเวลาออกงานใช่หรือไม่?")) {
                processClockOut(logs, logIndex, currentTime, loc, det, diffMs);
            }
        }
    }
};

const processClockOut = (logs, logIndex, currentTime, loc, det, diffMs) => {
    logs[logIndex].timeOut = currentTime;
    logs[logIndex].location = loc; 
    logs[logIndex].details = det;
    
    let totalHrs = diffMs / 3600000;
    if (totalHrs < 0) totalHrs = 0;
    logs[logIndex].normalHrs = (totalHrs > 8 ? 8 : totalHrs).toFixed(2);
    logs[logIndex].otHrs = (totalHrs > 8 ? totalHrs - 8 : 0).toFixed(2);

    setData('hr_worklogs_v13', logs); 
    showSwal('CHECK-OUT สำเร็จ', `ทำงานรวม: ${logs[logIndex].normalHrs} ชม.`, 'success');
    if(currentUser.role === 'employee' && typeof renderEmployeeUI === 'function') renderEmployeeUI();
    if(currentUser.role === 'manager' && typeof renderManagerUI === 'function') renderManagerUI();
};

const saveDailyDetails = (e) => {
    e.preventDefault();
    const loc = document.getElementById('workLocation').value;
    const det = document.getElementById('workDetails').value;
    const logs = getData('hr_worklogs_v13');
    const todayStr = new Date().toLocaleDateString('en-CA');
    const logIndex = logs.findIndex(w => w.userId === currentUser.id && w.date === todayStr);

    if(logIndex > -1) {
        logs[logIndex].location = loc; logs[logIndex].details = det;
        setData('hr_worklogs_v13', logs); 
        showSwal('บันทึกข้อมูลเรียบร้อย', 'อัปเดตรายละเอียดงานของคุณลงระบบแล้ว', 'success');
    } else {
        showSwal('ไม่สามารถบันทึกได้', 'กรุณากด STAMP เข้างานก่อนบันทึกข้อมูลรายละเอียด', 'error');
    }
};

// ==========================================
// 5. ระบบการลา (Leave Management)
// ==========================================
const handleLeaveSubmit = (renderCallback) => {
    const type = document.getElementById('leaveType').value;
    const date = document.getElementById('leaveDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if(!type) return showSwal('เกิดข้อผิดพลาด', 'กรุณาเลือกประเภทการลา', 'warning');
    if(currentUser.leaveBalances[type] <= 0) return showSwal('ไม่สามารถยื่นลาได้', `สิทธิ ${leaveTypesTH[type]} ของคุณหมดแล้ว`, 'error');

    const leaves = getData('hr_leaves_v13');
    leaves.push({ id: Date.now(), userId: currentUser.id, type: type, date: date, reason: reason, status: 'รอพิจารณา' });
    setData('hr_leaves_v13', leaves);
    
    document.getElementById('leaveType').value = ''; document.getElementById('leaveDate').value = ''; document.getElementById('leaveReason').value = '';
    showSwal('ส่งคำขอสำเร็จ!', 'ระบบได้รับคำขอการลาของคุณแล้ว กรุณารอการอนุมัติ', 'success');
    if(typeof renderCallback === 'function') renderCallback();
};

const cancelMyLeave = (leaveId, renderCallback) => {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'ยืนยันการยกเลิก?',
            text: "คุณต้องการยกเลิกคำขอการลานี้ใช่หรือไม่?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'ปิด',
            confirmButtonText: 'ใช่, ยกเลิกเลย!'
        }).then((result) => {
            if (result.isConfirmed) processCancelLeave(leaveId, renderCallback);
        });
    } else {
        if(confirm("คุณต้องการยกเลิกคำขอการลานี้ใช่หรือไม่?")) processCancelLeave(leaveId, renderCallback);
    }
};

const processCancelLeave = (leaveId, renderCallback) => {
    const leaves = getData('hr_leaves_v13');
    const leave = leaves.find(l => l.id == leaveId);
    if(leave && leave.status === 'รอพิจารณา') {
        leave.status = 'ยกเลิก';
        setData('hr_leaves_v13', leaves);
        showSwal('ยกเลิกสำเร็จ!', 'คำขอการลาของคุณถูกยกเลิกแล้ว', 'success');
        if(typeof renderCallback === 'function') renderCallback();
    }
}

const updateLeaveStatus = (leaveId, status, userId, type, roleUpdater) => {
    const leaves = getData('hr_leaves_v13');
    leaves.find(l => l.id == leaveId).status = status;
    setData('hr_leaves_v13', leaves);
    
    if(status === 'อนุมัติ') {
        const users = getData('hr_users_v13');
        const u = users.find(user => user.id === userId);
        if(u && u.leaveBalances[type] > 0) { u.leaveBalances[type] -= 1; setData('hr_users_v13', users); }
    }
    showSwal('ทำรายการสำเร็จ', `เปลี่ยนสถานะเป็น ${status} เรียบร้อยแล้ว`, status === 'อนุมัติ' ? 'success' : 'info');
    if(roleUpdater === 'admin') renderAdminUI();
    else if(roleUpdater === 'manager') renderManagerUI();
};

// ==========================================
// 6. หน้า Admin UI Rendering
// ==========================================
const renderAdminUI = () => {
    if(!document.getElementById('adminEmployeeTableBody')) return;
    const users = getData('hr_users_v13');
    const leaves = getData('hr_leaves_v13');

    // 6.1 ตารางจัดการพนักงาน
    const empTbody = document.getElementById('adminEmployeeTableBody');
    empTbody.innerHTML = '';
    users.forEach(u => {
        let idCardDisplay = u.idCard ? u.idCard.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, "$1-$2-$3-$4-$5") : '-';
        empTbody.innerHTML += `<tr><td><span class="fw-bold">${u.id}</span></td><td>${idCardDisplay}</td><td class="fw-bold">${u.name}</td><td>${getRoleBadge(u.role)}</td><td><button class="btn btn-sm btn-outline-primary me-1 shadow-sm" onclick="openEditEmployeeModal('${u.id}')"><i class="bi bi-pencil"></i> แก้ไข</button><button class="btn btn-sm btn-outline-danger shadow-sm" onclick="deleteEmployee('${u.id}')"><i class="bi bi-trash"></i> ลบ</button></td></tr>`;
    });

    // 6.2 ตารางอนุมัติ Manager
    const approveTbody = document.getElementById('adminApproveManagerTableBody');
    if(approveTbody) {
        approveTbody.innerHTML = '';
        leaves.forEach(l => {
            const u = users.find(x => x.id === l.userId);
            if(u && u.role === 'manager') {
                let btnHTML = l.status === 'รอพิจารณา' 
                    ? `<button class="btn btn-sm btn-success me-1 shadow-sm" onclick="updateLeaveStatus('${l.id}','อนุมัติ','${l.userId}','${l.type}','admin')">อนุมัติ</button><button class="btn btn-sm btn-danger shadow-sm" onclick="updateLeaveStatus('${l.id}','ไม่อนุมัติ','','','admin')">ไม่อนุมัติ</button>`
                    : `-`;
                approveTbody.innerHTML += `<tr><td><span class="fw-bold">${u.name}</span></td><td><span class="badge bg-light text-dark border">${leaveTypesTH[l.type]}</span></td><td>${l.date}</td><td class="text-start">${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${btnHTML}</td></tr>`;
            }
        });
    }

    // 6.3 ตาราง Report
    const reportTbody = document.getElementById('adminReportTableBody');
    if(reportTbody) {
        reportTbody.innerHTML = '';
        leaves.forEach(l => {
            const u = users.find(x => x.id === l.userId);
            reportTbody.innerHTML += `<tr><td><span class="text-primary fw-bold">${l.userId}</span></td><td>${u ? u.name : '-'}</td><td>${u ? getRoleBadge(u.role) : '-'}</td><td>${leaveTypesTH[l.type]}</td><td>${l.date}</td><td>${getStatusBadge(l.status)}</td></tr>`;
        });
    }
};

const handleAddEmployee = (e) => {
    e.preventDefault();
    const users = getData('hr_users_v13');
    const newId = document.getElementById('regId').value;
    const idCard = document.getElementById('regIdCard').value;

    if(users.find(u => u.id === newId)) return showSwal('ไม่สามารถเพิ่มได้', 'รหัสพนักงานนี้มีอยู่แล้วในระบบ', 'error');
    const autoPassword = idCard.slice(-4); 

    users.push({ id: newId, idCard: idCard, pass: autoPassword, name: document.getElementById('regName').value, role: document.getElementById('regRole').value, leaveBalances: { sick: 30, personal: 3, annual: 6 }, leaveTotal: { sick: 30, personal: 3, annual: 6 } });
    setData('hr_users_v13', users); document.getElementById('addEmployeeForm').reset(); renderAdminUI();
    showSwal('ลงทะเบียนสำเร็จ!', `รหัสผ่านเบื้องต้นคือ: ${autoPassword}`, 'success');
};

const deleteEmployee = (id) => { 
    if(id === 'admin') return showSwal('ปฏิเสธการเข้าถึง', 'ไม่สามารถลบ Admin หลักได้', 'error'); 
    if (typeof Swal !== 'undefined') {
        Swal.fire({ title: 'ยืนยันการลบ?', text: "ข้อมูลพนักงานจะถูกลบถาวร", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ลบข้อมูล' }).then((result) => {
            if(result.isConfirmed) { setData('hr_users_v13', getData('hr_users_v13').filter(u => u.id !== id)); renderAdminUI(); showSwal('ลบข้อมูลสำเร็จ', '', 'success'); }
        });
    } else {
        if(confirm("ยืนยันการลบข้อมูลพนักงานใช่หรือไม่?")) {
            setData('hr_users_v13', getData('hr_users_v13').filter(u => u.id !== id)); renderAdminUI(); showSwal('ลบข้อมูลสำเร็จ', '', 'success');
        }
    }
};

let currentEditEmpId = null;
const openEditEmployeeModal = (id) => {
    const u = getData('hr_users_v13').find(x => x.id === id);
    if(u) {
        currentEditEmpId = id;
        document.getElementById('editEmpIdDisplay').value = u.id;
        document.getElementById('editEmpIdCardInput').value = u.idCard || '';
        document.getElementById('editEmpNameInput').value = u.name;
        document.getElementById('editEmpRoleInput').value = u.role;
        new bootstrap.Modal(document.getElementById('editEmpModal')).show();
    }
};

const saveEditEmployee = () => {
    const users = getData('hr_users_v13');
    const u = users.find(x => x.id === currentEditEmpId);
    if(u) {
        const newIdCard = document.getElementById('editEmpIdCardInput').value.trim();
        if(newIdCard.length !== 13) return showSwal('ข้อผิดพลาด', 'กรุณากรอกเลข ปชช. ให้ครบ 13 หลัก', 'error');
        u.idCard = newIdCard; u.pass = newIdCard.slice(-4); u.name = document.getElementById('editEmpNameInput').value.trim(); u.role = document.getElementById('editEmpRoleInput').value;
        setData('hr_users_v13', users); renderAdminUI();
        bootstrap.Modal.getInstance(document.getElementById('editEmpModal')).hide();
        showSwal('อัปเดตข้อมูลสำเร็จ', 'ข้อมูลพนักงานถูกแก้ไขเรียบร้อยแล้ว', 'success');
    }
};

// ==========================================
// 7. หน้า Manager UI Rendering (SPA Logic)
// ==========================================
const renderManagerUI = () => {
    currentUser = getData('hr_users_v13').find(u => u.id === currentUser.id);
    
    // อัปเดตข้อมูลเมนูหลัก (Manager)
    if(document.getElementById('empProfileNameMenu')) document.getElementById('empProfileNameMenu').innerText = currentUser.name;
    if(document.getElementById('empProfileNameTime')) document.getElementById('empProfileNameTime').innerText = currentUser.name;
    if(document.getElementById('empProfileId')) document.getElementById('empProfileId').innerText = currentUser.id;
    if(document.getElementById('empProfileRole')) document.getElementById('empProfileRole').innerText = 'Administration Officer';

    // อัปเดตสถิติโควตาตัวเอง
    if(document.getElementById('statPersBal')) {
        const total = currentUser.leaveTotal || { sick: 30, personal: 3.5, annual: 6 };
        document.getElementById('statPersBal').innerText = currentUser.leaveBalances.personal;
        document.getElementById('statPersUsed').innerText = (total.personal - currentUser.leaveBalances.personal).toFixed(1);
        
        document.getElementById('statSickBal').innerText = currentUser.leaveBalances.sick;
        document.getElementById('statSickUsed').innerText = total.sick - currentUser.leaveBalances.sick;
        
        document.getElementById('statAnnBal').innerText = currentUser.leaveBalances.annual;
        document.getElementById('statAnnUsed').innerText = total.annual - currentUser.leaveBalances.annual;
    }

    const users = getData('hr_users_v13');
    const leaves = getData('hr_leaves_v13');

    // ตารางประวัติการลาของตัวเอง
    const myLeaveTbody = document.getElementById('myLeaveStatusTable');
    if(myLeaveTbody) {
        myLeaveTbody.innerHTML = '';
        leaves.filter(l => l.userId === currentUser.id).forEach(l => {
            let cancelBtn = (l.status === 'รอพิจารณา') ? `<button class="btn btn-sm btn-outline-danger shadow-sm rounded-pill px-3" onclick="cancelMyLeave('${l.id}', renderManagerUI)"><i class="bi bi-x-lg"></i></button>` : '-';
            myLeaveTbody.innerHTML += `<tr><td>${l.date}</td><td><span class="badge bg-light text-dark border">${leaveTypesTH[l.type]}</span></td><td>${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${cancelBtn}</td></tr>`;
        });
    }

    // โค้ดอนุมัติลูกน้อง
    const tbody = document.getElementById('managerApprovalTableBody');
    if(tbody) {
        tbody.innerHTML = '';
        leaves.forEach(l => {
            const u = users.find(user => user.id === l.userId);
            if(u && u.role === 'employee') {
                let btnHTML = l.status === 'รอพิจารณา' 
                    ? `<button class="btn btn-sm btn-success me-1 mb-1 shadow-sm" onclick="updateLeaveStatus('${l.id}','อนุมัติ','${l.userId}','${l.type}','manager')"><i class="bi bi-check2"></i> อนุมัติ</button><button class="btn btn-sm btn-danger me-1 mb-1 shadow-sm" onclick="updateLeaveStatus('${l.id}','ไม่อนุมัติ','','','manager')"><i class="bi bi-x-lg"></i> ปฏิเสธ</button><button class="btn btn-sm btn-outline-primary mb-1 shadow-sm" onclick="openEditLeaveModal('${l.id}')"><i class="bi bi-pencil"></i> แก้ไข</button>`
                    : `<button class="btn btn-sm btn-outline-primary shadow-sm" onclick="openEditLeaveModal('${l.id}')"><i class="bi bi-pencil"></i> แก้ไข</button>`;
                tbody.innerHTML += `<tr><td><span class="fw-bold">${u.name}</span></td><td><span class="badge bg-light text-dark border">${leaveTypesTH[l.type]}</span></td><td>${l.date}</td><td class="text-start">${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${btnHTML}</td></tr>`;
            }
        });
    }

    // อัปเดตหน้าลงเวลาของ Manager
    updateTimeTrackingUIData();
};

let currentEditLeaveId = null;
const openEditLeaveModal = (leaveId) => {
    const leave = getData('hr_leaves_v13').find(l => l.id == leaveId);
    if (leave) {
        currentEditLeaveId = leaveId;
        document.getElementById('editLeaveDateInput').value = leave.date;
        document.getElementById('editLeaveReasonInput').value = leave.reason;
        new bootstrap.Modal(document.getElementById('editLeaveModal')).show();
    }
};

const saveEditLeave = () => {
    const leaves = getData('hr_leaves_v13');
    const leave = leaves.find(l => l.id == currentEditLeaveId);
    if(leave) {
        leave.date = document.getElementById('editLeaveDateInput').value.trim();
        leave.reason = document.getElementById('editLeaveReasonInput').value.trim();
        setData('hr_leaves_v13', leaves); renderManagerUI();
        bootstrap.Modal.getInstance(document.getElementById('editLeaveModal')).hide();
        showSwal('แก้ไขสำเร็จ', 'อัปเดตข้อมูลคำขอการลาเรียบร้อย', 'success');
    }
};

// ==========================================
// 8. หน้า Employee UI Rendering (SPA Logic)
// ==========================================
const renderEmployeeUI = () => {
    currentUser = getData('hr_users_v13').find(u => u.id === currentUser.id);
    
    if(document.getElementById('empProfileNameMenu')) document.getElementById('empProfileNameMenu').innerText = currentUser.name;
    if(document.getElementById('empProfileNameTime')) document.getElementById('empProfileNameTime').innerText = currentUser.name;
    if(document.getElementById('empProfileId')) document.getElementById('empProfileId').innerText = currentUser.id;
    if(document.getElementById('empProfileRole')) document.getElementById('empProfileRole').innerText = 'Staff';

    if(document.getElementById('statPersBal')) {
        const total = currentUser.leaveTotal || { sick: 30, personal: 3.5, annual: 6 };
        document.getElementById('statPersBal').innerText = currentUser.leaveBalances.personal;
        document.getElementById('statPersUsed').innerText = (total.personal - currentUser.leaveBalances.personal).toFixed(1);
        
        document.getElementById('statSickBal').innerText = currentUser.leaveBalances.sick;
        document.getElementById('statSickUsed').innerText = total.sick - currentUser.leaveBalances.sick;
        
        document.getElementById('statAnnBal').innerText = currentUser.leaveBalances.annual;
        document.getElementById('statAnnUsed').innerText = total.annual - currentUser.leaveBalances.annual;
    }

    const lTbody = document.getElementById('myLeaveStatusTable');
    if(lTbody) {
        lTbody.innerHTML = '';
        getData('hr_leaves_v13').filter(l => l.userId === currentUser.id).forEach(l => {
            let cancelBtn = (l.status === 'รอพิจารณา') ? `<button class="btn btn-sm btn-outline-danger shadow-sm rounded-pill px-3" onclick="cancelMyLeave('${l.id}', renderEmployeeUI)"><i class="bi bi-x-lg"></i></button>` : '-';
            lTbody.innerHTML += `<tr><td>${l.date}</td><td><span class="badge bg-light text-dark border">${leaveTypesTH[l.type]}</span></td><td>${l.reason}</td><td>${getStatusBadge(l.status)}</td><td>${cancelBtn}</td></tr>`;
        });
    }

    updateTimeTrackingUIData();
};

// ==========================================
// Shared Time Tracking UI Updater
// ==========================================
const updateTimeTrackingUIData = () => {
    const todayStrCA = new Date().toLocaleDateString('en-CA');
    if(document.getElementById('empCurrentDateDisplay')) {
        document.getElementById('empCurrentDateDisplay').innerText = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const logs = getData('hr_worklogs_v13');
    const todayLog = logs.find(w => w.userId === currentUser.id && w.date === todayStrCA);
    const btnStamp = document.getElementById('btnStampTime');

    if(document.getElementById('displayCheckIn')) {
        document.getElementById('displayCheckIn').innerText = todayLog ? todayLog.timeIn : '-';
        document.getElementById('displayCheckOut').innerText = (todayLog && todayLog.timeOut) ? todayLog.timeOut : '-';
        document.getElementById('displayWorkHr').innerText = (todayLog && todayLog.normalHrs) ? todayLog.normalHrs : '0.00';
        document.getElementById('displayOtHr').innerText = (todayLog && todayLog.otHrs) ? todayLog.otHrs : '0.00';

        if(todayLog) {
            document.getElementById('workLocation').value = todayLog.location || '';
            document.getElementById('workDetails').value = todayLog.details || '';
        } else {
            document.getElementById('workLocation').value = '';
            document.getElementById('workDetails').value = '';
        }

        if(!todayLog) {
            btnStamp.disabled = false;
            btnStamp.className = "btn btn-success btn-lg w-100 fw-bold shadow-sm rounded-pill";
            btnStamp.innerHTML = '<i class="bi bi-fingerprint"></i> STAMP เข้างาน';
        } else if (!todayLog.timeOut) {
            btnStamp.disabled = false;
            btnStamp.className = "btn btn-danger btn-lg w-100 fw-bold shadow-sm rounded-pill";
            btnStamp.innerHTML = '<i class="bi bi-fingerprint"></i> STAMP ออกงาน';
        } else {
            btnStamp.disabled = true;
            btnStamp.className = "btn btn-secondary btn-lg w-100 fw-bold shadow-sm rounded-pill";
            btnStamp.innerHTML = '<i class="bi bi-check-circle"></i> บันทึกเวลาครบแล้ว';
        }
    }
}

// นาฬิกา Real-time
setInterval(() => { if(document.getElementById('empCurrentTime')) document.getElementById('empCurrentTime').innerText = new Date().toLocaleTimeString('th-TH'); }, 1000);