// ==========================================
// 1. ระบบฐานข้อมูล (Version 9 - Bootstrap 5 Pro UX)
// ==========================================
const initDB = () => {
    if (!localStorage.getItem('hr_users_v9')) {
        const users = [
            { id: 'admin', idCard: '0000000001234', pass: '1234', role: 'admin', name: 'ผู้ดูแลระบบสูงสุด', leaveBalances: { sick: 30, personal: 3, annual: 6 } },
            { id: 'mgr01', idCard: '1111111111234', pass: '1234', role: 'manager', name: 'ผู้จัดการแผนก IT', leaveBalances: { sick: 30, personal: 3, annual: 6 } },
            { id: 'emp01', idCard: '2222222221234', pass: '1234', role: 'employee', name: 'พนักงาน สมชาย', leaveBalances: { sick: 30, personal: 3, annual: 6 } }
        ];
        localStorage.setItem('hr_users_v9', JSON.stringify(users));
        localStorage.setItem('hr_leaves_v9', JSON.stringify([]));
        localStorage.setItem('hr_worklogs_v9', JSON.stringify([]));
    }
};

const getData = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setData = (key, data) => localStorage.setItem(key, JSON.stringify(data));
let currentUser = JSON.parse(localStorage.getItem('hr_currentUser_v9'));
const leaveTypesTH = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน' };

// --- ฟังก์ชันแจ้งเตือนแบบมืออาชีพ (Bootstrap Toast) ---
const showToast = (message, type = 'success') => {
    const toastEl = document.getElementById('liveToast');
    if(!toastEl) { alert(message); return; } // สำรองไว้เผื่อหน้าไหนไม่ได้ใส่โค้ด HTML Toast
    
    document.getElementById('toastMessage').innerText = message;
    document.getElementById('toastHeader').className = `toast-header text-white bg-${type}`;
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
};

// ==========================================
// 2. ระบบตรวจสอบสิทธิ์
// ==========================================
const checkAuth = (requiredRole) => {
    initDB();
    if (!currentUser && requiredRole !== 'login') window.location.href = 'index.html'; 
    else if (currentUser && requiredRole === 'login') {
        if(currentUser.role === 'admin') window.location.href = 'admin.html';
        else if(currentUser.role === 'manager') window.location.href = 'manager.html';
        else if(currentUser.role === 'employee') window.location.href = 'employee.html';
    } else if (currentUser && requiredRole !== 'login' && currentUser.role !== requiredRole) {
        window.location.href = 'index.html';
    }
    const navUser = document.getElementById('navUserInfo');
    if(navUser && currentUser) navUser.innerText = `${currentUser.name} (${currentUser.role})`;
};

const handleLogin = (e) => {
    e.preventDefault();
    const userInp = document.getElementById('loginUsername').value;
    const passInp = document.getElementById('loginPassword').value;
    const foundUser = getData('hr_users_v9').find(u => u.id === userInp && u.pass === passInp);

    if (foundUser) {
        localStorage.setItem('hr_currentUser_v9', JSON.stringify(foundUser));
        window.location.reload(); 
    } else showToast('รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', 'danger');
};
const logout = () => { localStorage.removeItem('hr_currentUser_v9'); window.location.href = 'index.html'; };

// ==========================================
// 3. ฟังก์ชันหน้า Admin (เปลี่ยน Prompt เป็น Modal)
// ==========================================
const renderAdminUI = () => {
    const users = getData('hr_users_v9');
    const tbody = document.getElementById('adminEmployeeTableBody');
    if(tbody) {
        tbody.innerHTML = '';
        users.forEach(u => {
            let idCardDisplay = u.idCard ? u.idCard.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, "$1-$2-$3-$4-$5") : '-';
            tbody.innerHTML += `
                <tr>
                    <td><span class="fw-bold text-primary">${u.id}</span></td>
                    <td>${idCardDisplay}</td>
                    <td>${u.name}</td>
                    <td><span class="badge bg-secondary">${u.role.toUpperCase()}</span></td>
                    <td class="small text-start">ป่วย: ${u.leaveBalances.sick} | กิจ: ${u.leaveBalances.personal} | พักร้อน: ${u.leaveBalances.annual}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary shadow-sm" onclick="editEmployeeName('${u.id}')">แก้ไขชื่อ</button>
                        <button class="btn btn-sm btn-outline-danger shadow-sm" onclick="deleteEmployee('${u.id}')">ลบ</button>
                    </td>
                </tr>`;
        });
    }

    const leaveTbody = document.getElementById('adminLeaveTableBody');
    if(leaveTbody) {
        leaveTbody.innerHTML = '';
        getData('hr_leaves_v9').forEach(l => {
            const u = users.find(user => user.id === l.userId);
            let bClass = l.status === 'อนุมัติ' ? 'bg-success' : (l.status === 'ไม่อนุมัติ' ? 'bg-danger' : 'bg-warning text-dark');
            leaveTbody.innerHTML += `
                <tr>
                    <td>${u ? u.name : l.userId}</td>
                    <td><span class="badge bg-info text-dark shadow-sm">${leaveTypesTH[l.type]}</span></td>
                    <td>${l.date}</td><td>${l.reason}</td>
                    <td><span class="badge ${bClass} shadow-sm">${l.status}</span></td>
                    <td>
                        <select class="form-select form-select-sm d-inline w-auto shadow-sm" onchange="adminUpdateLeave('${l.id}', this.value)">
                            <option value="" disabled selected>เปลี่ยนสถานะ</option>
                            <option value="อนุมัติ">อนุมัติ</option>
                            <option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
                        </select>
                    </td>
                </tr>`;
        });
    }
};

const handleAddEmployee = (e) => {
    e.preventDefault();
    const users = getData('hr_users_v9');
    const newId = document.getElementById('regId').value;
    const idCard = document.getElementById('regIdCard').value;

    if(users.find(u => u.id === newId)) return showToast('รหัสพนักงานนี้มีอยู่แล้วในระบบ', 'danger');
    const autoPassword = idCard.slice(-4); 

    users.push({
        id: newId, idCard: idCard, pass: autoPassword, 
        name: document.getElementById('regName').value, role: document.getElementById('regRole').value, 
        leaveBalances: { sick: 30, personal: 3, annual: 6 }
    });
    setData('hr_users_v9', users); document.getElementById('addEmployeeForm').reset(); renderAdminUI();
    showToast(`เพิ่มพนักงานสำเร็จ! รหัสผ่านคือ: ${autoPassword}`, 'success');
};

const deleteEmployee = (id) => {
    if(id === 'admin') return showToast('ลบ Admin หลักไม่ได้', 'danger');
    if(confirm('ยืนยันการลบข้อมูลพนักงาน?')) { setData('hr_users_v9', getData('hr_users_v9').filter(u => u.id !== id)); renderAdminUI(); showToast('ลบพนักงานสำเร็จ', 'success');}
};

// การทำงานของ Modal แก้ไขชื่อ
let currentEditEmpId = null;
const editEmployeeName = (id) => {
    const users = getData('hr_users_v9');
    const u = users.find(x => x.id === id);
    if(u) {
        currentEditEmpId = id;
        document.getElementById('editEmpNameInput').value = u.name;
        new bootstrap.Modal(document.getElementById('editEmpModal')).show();
    }
};
const saveEditEmployee = () => {
    const users = getData('hr_users_v9');
    const u = users.find(x => x.id === currentEditEmpId);
    if(u) {
        u.name = document.getElementById('editEmpNameInput').value.trim();
        setData('hr_users_v9', users); renderAdminUI();
        bootstrap.Modal.getInstance(document.getElementById('editEmpModal')).hide();
        showToast('อัปเดตชื่อพนักงานเรียบร้อย', 'primary');
    }
};

const adminUpdateLeave = (leaveId, newStatus) => {
    const leaves = getData('hr_leaves_v9');
    leaves.find(l => l.id == leaveId).status = newStatus;
    setData('hr_leaves_v9', leaves); renderAdminUI(); showToast(`เปลี่ยนสถานะเป็น ${newStatus} แล้ว`, 'success');
};

// ==========================================
// 4. ฟังก์ชันหน้า Manager (เปลี่ยน Prompt เป็น Modal)
// ==========================================
const renderManagerUI = () => {
    if(!document.getElementById('mgrSickBal')) return;
    currentUser = getData('hr_users_v9').find(u => u.id === currentUser.id);
    document.getElementById('mgrSickBal').innerText = currentUser.leaveBalances.sick;
    document.getElementById('mgrPersBal').innerText = currentUser.leaveBalances.personal;
    document.getElementById('mgrAnnBal').innerText = currentUser.leaveBalances.annual;
    
    const tbody = document.getElementById('managerApprovalTableBody');
    tbody.innerHTML = '';
    const users = getData('hr_users_v9');
    
    getData('hr_leaves_v9').forEach(l => {
        const u = users.find(user => user.id === l.userId);
        if(u && u.role === 'employee') {
            let btnHTML = '';
            if (l.status === 'รอพิจารณา') {
                btnHTML = `
                    <button class="btn btn-sm btn-success shadow-sm me-1 mb-1" onclick="mgrUpdateLeave('${l.id}','อนุมัติ','${l.userId}','${l.type}')"><i class="bi bi-check2"></i> อนุมัติ</button>
                    <button class="btn btn-sm btn-danger shadow-sm me-1 mb-1" onclick="mgrUpdateLeave('${l.id}','ไม่อนุมัติ','','')"><i class="bi bi-x-lg"></i> ปฏิเสธ</button>
                    <button class="btn btn-sm btn-outline-primary shadow-sm mb-1" onclick="editLeaveByManager('${l.id}')"><i class="bi bi-pencil"></i> แก้ไข</button>`;
            } else {
                btnHTML = `<button class="btn btn-sm btn-outline-primary shadow-sm" onclick="editLeaveByManager('${l.id}')"><i class="bi bi-pencil"></i> แก้ไข</button>`;
            }
            tbody.innerHTML += `<tr><td>${u.name}</td><td><span class="badge bg-info text-dark">${leaveTypesTH[l.type]}</span></td><td>${l.date}</td><td>${l.reason}</td><td class="text-warning fw-bold">${l.status}</td><td>${btnHTML}</td></tr>`;
        }
    });
};

// การทำงานของ Modal แก้ไขการลา (Manager)
let currentEditLeaveId = null;
const editLeaveByManager = (leaveId) => {
    const leaves = getData('hr_leaves_v9');
    const leave = leaves.find(l => l.id == leaveId);
    if (leave) {
        currentEditLeaveId = leaveId;
        document.getElementById('editLeaveDateInput').value = leave.date;
        document.getElementById('editLeaveReasonInput').value = leave.reason;
        new bootstrap.Modal(document.getElementById('editLeaveModal')).show();
    }
};
const saveEditLeave = () => {
    const leaves = getData('hr_leaves_v9');
    const leave = leaves.find(l => l.id == currentEditLeaveId);
    if(leave) {
        leave.date = document.getElementById('editLeaveDateInput').value.trim();
        leave.reason = document.getElementById('editLeaveReasonInput').value.trim();
        setData('hr_leaves_v9', leaves); renderManagerUI();
        bootstrap.Modal.getInstance(document.getElementById('editLeaveModal')).hide();
        showToast('แก้ไขข้อมูลการลาหยุดสำเร็จ', 'warning');
    }
};

const mgrUpdateLeave = (leaveId, status, userId, type) => {
    const leaves = getData('hr_leaves_v9');
    leaves.find(l => l.id == leaveId).status = status;
    setData('hr_leaves_v9', leaves);
    if(status === 'อนุมัติ') {
        const users = getData('hr_users_v9');
        const u = users.find(user => user.id === userId);
        if(u && u.leaveBalances[type] > 0) { u.leaveBalances[type] -= 1; setData('hr_users_v9', users); }
    }
    renderManagerUI(); showToast(`ทำรายการ ${status} สำเร็จ`, status === 'อนุมัติ' ? 'success' : 'danger');
};
const submitLeaveManager = (e) => { e.preventDefault(); handleLeaveSubmit('mgrLeaveType', 'mgrLeaveDate', 'mgrLeaveReason', renderManagerUI); };

// ==========================================
// 5. ฟังก์ชันหน้า Employee
// ==========================================
const renderEmployeeUI = () => {
    if(!document.getElementById('empSickBal')) return;
    
    currentUser = getData('hr_users_v9').find(u => u.id === currentUser.id);
    setData('hr_currentUser_v9', currentUser);
    document.getElementById('empSickBal').innerText = currentUser.leaveBalances.sick;
    document.getElementById('empPersBal').innerText = currentUser.leaveBalances.personal;
    document.getElementById('empAnnBal').innerText = currentUser.leaveBalances.annual;
    document.getElementById('empCurrentDate').innerText = new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const lTbody = document.getElementById('empLeaveStatusTable');
    lTbody.innerHTML = '';
    getData('hr_leaves_v9').filter(l => l.userId === currentUser.id).forEach(l => {
        let badgeClass = l.status === 'อนุมัติ' ? 'bg-success' : (l.status === 'ไม่อนุมัติ' ? 'bg-danger' : 'bg-warning text-dark');
        lTbody.innerHTML += `<tr><td><span class="badge bg-info text-dark shadow-sm">${leaveTypesTH[l.type]}</span></td><td>${l.date}</td><td>${l.reason}</td><td><span class="badge ${badgeClass} shadow-sm">${l.status}</span></td></tr>`;
    });

    const logs = getData('hr_worklogs_v9').filter(w => w.userId === currentUser.id);
    const wTbody = document.getElementById('empWorkLogTable');
    wTbody.innerHTML = '';
    let todayLog = null;
    const todayStr = new Date().toLocaleDateString('en-CA');

    logs.forEach(w => {
        wTbody.innerHTML += `<tr><td>${w.date}</td><td>${w.timeIn}</td><td>${w.timeOut || '-'}</td><td>${w.normalHrs || '-'}</td><td class="text-danger fw-bold">${w.otHrs || '-'}</td></tr>`;
        if(w.date === todayStr) todayLog = w;
    });

    const btnIn = document.getElementById('btnClockIn'); const btnOut = document.getElementById('btnClockOut');
    if(!todayLog) { btnIn.disabled = false; btnOut.disabled = true; }
    else if (!todayLog.timeOut) { btnIn.disabled = true; btnOut.disabled = false; }
    else { btnIn.disabled = true; btnOut.disabled = true; btnOut.innerText = 'บันทึกเวลาครบแล้ว'; }
};

const clockIn = () => {
    const logs = getData('hr_worklogs_v9');
    logs.push({ userId: currentUser.id, date: new Date().toLocaleDateString('en-CA'), timeIn: new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' }), timeOut: null, normalHrs: null, otHrs: null });
    setData('hr_worklogs_v9', logs); renderEmployeeUI(); showToast('บันทึกเวลาเข้างานเรียบร้อย', 'success');
};

const clockOut = () => {
    const logs = getData('hr_worklogs_v9');
    const todayStr = new Date().toLocaleDateString('en-CA');
    const logIndex = logs.findIndex(w => w.userId === currentUser.id && w.date === todayStr);
    
    if(logIndex > -1) {
        const timeOutStr = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' });
        logs[logIndex].timeOut = timeOutStr;
        
        const tIn = logs[logIndex].timeIn.split(':'); const tOut = timeOutStr.split(':');
        const diffMs = new Date(0,0,0,tOut[0],tOut[1]) - new Date(0,0,0,tIn[0],tIn[1]);
        let totalHrs = (diffMs / 1000 / 60 / 60);
        if (totalHrs < 0) totalHrs = 0;
        
        logs[logIndex].normalHrs = (totalHrs > 8 ? 8 : totalHrs).toFixed(2);
        logs[logIndex].otHrs = (totalHrs > 8 ? totalHrs - 8 : 0).toFixed(2);

        setData('hr_worklogs_v9', logs); renderEmployeeUI();
        showToast(`ออกงานสำเร็จ! เวลาปกติ: ${logs[logIndex].normalHrs} ชม. | OT: ${logs[logIndex].otHrs} ชม.`, 'info');
    }
};

const handleLeaveSubmit = (typeId, dateId, reasonId, renderCallback) => {
    const type = document.getElementById(typeId).value;
    const date = document.getElementById(dateId).value;
    const reason = document.getElementById(reasonId).value;
    if(!type) return showToast('กรุณาเลือกประเภทการลา', 'danger');
    if(currentUser.leaveBalances[type] <= 0) return showToast(`สิทธิ ${leaveTypesTH[type]} ของคุณหมดแล้ว!`, 'danger');

    const leaves = getData('hr_leaves_v9');
    leaves.push({ id: Date.now(), userId: currentUser.id, type: type, date: date, reason: reason, status: 'รอพิจารณา' });
    setData('hr_leaves_v9', leaves);
    
    document.getElementById(typeId).value = ''; document.getElementById(dateId).value = ''; document.getElementById(reasonId).value = '';
    showToast('ยื่นคำขอการลาหยุดสำเร็จ ระบบกำลังรอการอนุมัติ', 'success'); renderCallback();
};
const submitLeaveEmployee = (e) => { e.preventDefault(); handleLeaveSubmit('empLeaveType', 'empLeaveDate', 'empLeaveReason', renderEmployeeUI); };

setInterval(() => {
    const timeEl = document.getElementById('empCurrentTime');
    if(timeEl) timeEl.innerText = new Date().toLocaleTimeString('th-TH');
}, 1000);