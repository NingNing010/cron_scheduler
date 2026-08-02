const taskOutput = document.getElementById('taskOutput');
const employeeOutput = document.getElementById('employeeOutput');
const healthOutput = document.getElementById('healthOutput');
const tabButtons = document.querySelectorAll('[data-tab-target]');
const tabPanels = document.querySelectorAll('[data-tab-panel]');

let logPollingInterval = null;
let taskPollingInterval = null;
let employeePollingInterval = null;
let currentEmployeeId = null;

const ACCESS_STORAGE_KEY = 'cron-demo-access';
const DEFAULT_ACCESS = {
  roles: 'admin',
  permissions: 'employee:read,employee:create,employee:update,employee:delete,employee:import,employee:export,employee:bulk-create,file:upload,health:read,sync:run,sync:schedule',
};

function getAccessState() {
  try {
    return { ...DEFAULT_ACCESS, ...(JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || '{}') || {}) };
  } catch {
    return { ...DEFAULT_ACCESS };
  }
}

function saveAccessState(state) {
  localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(state));
}

function syncAccessInputs() {
  const state = getAccessState();
  document.getElementById('accessRoles').value = state.roles;
  document.getElementById('accessPermissions').value = state.permissions;
}

function buildAuthHeaders() {
  const state = getAccessState();
  return {
    'x-roles': state.roles,
    'x-permissions': state.permissions,
  };
}

function getTaskPayload() {
  return {
    name: document.getElementById('taskName').value.trim(),
    cronExpression: document.getElementById('taskCronExpression').value.trim(),
    recipientEmail: document.getElementById('taskRecipientEmail').value.trim(),
    subject: document.getElementById('taskSubject').value.trim(),
    content: document.getElementById('taskContent').value.trim(),
  };
}

function getEmployeePayload() {
  return {
    code: document.getElementById('employeeCode').value.trim(),
    fullName: document.getElementById('employeeFullName').value.trim(),
    email: document.getElementById('employeeEmail').value.trim(),
    phone: document.getElementById('employeePhone').value.trim(),
    department: document.getElementById('employeeDepartment').value.trim(),
    position: document.getElementById('employeePosition').value.trim(),
    notes: document.getElementById('employeeNotes').value.trim(),
    avatarUrl: document.getElementById('employeeAvatarUrl').value.trim(),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

async function postJson(url, body) {
  return requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function patchJson(url, body) {
  return requestJson(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function deleteJson(url) {
  return requestJson(url, { method: 'DELETE' });
}

async function getJson(url) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}_t=${Date.now()}`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

async function postFormData(url, formData) {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

async function downloadFile(url, filename) {
  const response = await fetch(url, { headers: buildAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Tải file thất bại');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return `${date.toLocaleTimeString('vi-VN')} - ${date.toLocaleDateString('vi-VN')}`;
}

function applyDefaultAccess() {
  if (!localStorage.getItem(ACCESS_STORAGE_KEY)) {
    saveAccessState(DEFAULT_ACCESS);
  }

  syncAccessInputs();
}

function activateTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.getAttribute('data-tab-target') === tabName;
    button.classList.toggle('is-active', isActive);
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.getAttribute('data-tab-panel') === tabName;
    panel.classList.toggle('is-hidden', !isActive);
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activateTab(button.getAttribute('data-tab-target'));
  });
});

document.getElementById('saveAccessBtn').addEventListener('click', () => {
  saveAccessState({
    roles: document.getElementById('accessRoles').value.trim() || DEFAULT_ACCESS.roles,
    permissions: document.getElementById('accessPermissions').value.trim() || DEFAULT_ACCESS.permissions,
  });
  alert('Đã lưu quyền demo.');
});

document.getElementById('resetAccessBtn').addEventListener('click', () => {
  saveAccessState(DEFAULT_ACCESS);
  syncAccessInputs();
  alert('Đã khôi phục quyền demo mặc định.');
});

// -----------------------------------------------------------------------------
// TASK LOG MODAL
// -----------------------------------------------------------------------------
const logModal = document.getElementById('logModal');

function closeAndClearModal() {
  logModal.style.display = 'none';
  if (logPollingInterval) {
    clearInterval(logPollingInterval);
    logPollingInterval = null;
  }
}

document.getElementById('closeModalBtn').addEventListener('click', closeAndClearModal);
window.addEventListener('click', (event) => {
  if (event.target === logModal) closeAndClearModal();
});

async function fetchAndRenderLogs(taskId) {
  const modalContent = document.getElementById('modalLogContent');
  try {
    const logs = await getJson(`/tasks/${taskId}/logs`);
    if (!logs.length) {
      modalContent.innerHTML = '<p style="color: #64748b; padding: 1rem 0;">Chưa có lịch sử chạy nào cho tác vụ này.</p>';
      return;
    }

    modalContent.innerHTML = `
      <table class="log-table">
        <thead>
          <tr>
            <th>Thời Gian Thực Thi</th>
            <th>Trạng Thái</th>
            <th>Chi Tiết / Phản Hồi SMTP</th>
          </tr>
        </thead>
        <tbody>
          ${logs
            .map(
              (log) => `
              <tr>
                <td style="white-space: nowrap;"><strong>${formatDate(log.executedAt)}</strong></td>
                <td><span class="badge badge-${log.status}">${log.status}</span></td>
                <td style="font-family: monospace; font-size: 0.8rem;">${log.message || '-'}</td>
              </tr>
            `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    modalContent.innerHTML = `<p style="color: #dc2626;">Lỗi tải log: ${error.message}</p>`;
  }
}

function showLogsModal(taskId) {
  document.getElementById('modalTaskId').textContent = taskId;
  document.getElementById('modalLogContent').innerHTML = '<p>Đang lấy dữ liệu...</p>';
  logModal.style.display = 'block';

  fetchAndRenderLogs(taskId);

  if (logPollingInterval) clearInterval(logPollingInterval);
  logPollingInterval = setInterval(() => {
    if (logModal.style.display === 'block') {
      fetchAndRenderLogs(taskId);
    }
  }, 2000);
}

// -----------------------------------------------------------------------------
// TASKS
// -----------------------------------------------------------------------------
function renderTasks(tasks) {
  if (!tasks.length) {
    taskOutput.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">Chưa có tác vụ lập lịch nào.</div>';
    return;
  }

  taskOutput.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Tác Vụ & Người Nhận</th>
          <th>Chu Kỳ Cron</th>
          <th>Mail Đã Gửi</th>
          <th>Lần Chạy Tiếp Theo (Next Run)</th>
          <th>Trạng Thái</th>
          <th style="text-align: right;">Thao Tác</th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `
              <tr>
                <td><strong>#${task.id}</strong></td>
                <td>
                  <div style="font-weight: 600; color: #0f172a;">${task.name}</div>
                  <div style="font-size: 0.8rem; color: #64748b;">💌 ${task.recipientEmail || 'N/A'}</div>
                </td>
                <td><code>${task.cronExpression}</code></td>
                <td style="font-weight: 600; color: #0f172a;">${task.sendCount ?? 0}/${task.maxMailCount ?? 5}</td>
                <td style="color: #2563eb; font-weight: 600;">${formatDate(task.nextRun)}</td>
                <td><span class="pill">${task.status}</span></td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-right: 0.25rem;" data-view-log="${task.id}">Xem Log</button>
                  <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" data-delete-task="${task.id}">Xóa</button>
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('[data-view-log]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-view-log');
      showLogsModal(id);
    });
  });

  document.querySelectorAll('[data-delete-task]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-delete-task');
      if (!confirm(`Bạn có chắc muốn xóa tác vụ #${id} không?`)) return;
      await deleteJson(`/tasks/${id}`);
      await loadTasks();
    });
  });
}

async function loadTasks(silent = false) {
  if (!silent) taskOutput.innerHTML = '<div style="padding: 1rem; color: #64748b;">Đang tải danh sách tác vụ...</div>';
  try {
    renderTasks(await getJson('/tasks'));
  } catch (error) {
    if (!silent) taskOutput.innerHTML = `<div style="color: #dc2626; padding: 1rem;">Lỗi kết nối API: ${error.message}</div>`;
  }
}

document.getElementById('createTaskBtn').addEventListener('click', async () => {
  const btn = document.getElementById('createTaskBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Đang đẩy vào Redis Queue...';
  btn.disabled = true;

  try {
    await postJson('/tasks', getTaskPayload());
    await loadTasks();
    document.getElementById('taskSubject').value = 'Thông báo từ hệ thống tự động';
  } catch (error) {
    alert(`Không thể tạo tác vụ: ${error.message}`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

document.getElementById('refreshTasksBtn').addEventListener('click', () => loadTasks(false));

// -----------------------------------------------------------------------------
// EMPLOYEES
// -----------------------------------------------------------------------------
function clearEmployeeForm() {
  currentEmployeeId = null;
  document.getElementById('employeeId').value = '';
  document.getElementById('employeeCode').value = '';
  document.getElementById('employeeFullName').value = '';
  document.getElementById('employeeEmail').value = '';
  document.getElementById('employeePhone').value = '';
  document.getElementById('employeeDepartment').value = '';
  document.getElementById('employeePosition').value = '';
  document.getElementById('employeeNotes').value = '';
  document.getElementById('employeeAvatarUrl').value = '';
  document.getElementById('saveEmployeeBtn').textContent = 'Tạo nhân viên';
}

function fillEmployeeForm(employee) {
  currentEmployeeId = employee.id;
  document.getElementById('employeeId').value = employee.id;
  document.getElementById('employeeCode').value = employee.code || '';
  document.getElementById('employeeFullName').value = employee.fullName || '';
  document.getElementById('employeeEmail').value = employee.email || '';
  document.getElementById('employeePhone').value = employee.phone || '';
  document.getElementById('employeeDepartment').value = employee.department || '';
  document.getElementById('employeePosition').value = employee.position || '';
  document.getElementById('employeeNotes').value = employee.notes || '';
  document.getElementById('employeeAvatarUrl').value = employee.avatarUrl || '';
  document.getElementById('saveEmployeeBtn').textContent = 'Cập nhật nhân viên';
}

function renderEmployees(payload) {
  const employees = payload.items || [];
  if (!employees.length) {
    employeeOutput.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">Chưa có nhân viên nào.</div>';
    return;
  }

  employeeOutput.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Mã / Họ tên</th>
          <th>Email / Phòng ban</th>
          <th>Chức danh</th>
          <th>Synced</th>
          <th>Trạng thái</th>
          <th style="text-align: right;">Thao tác</th>
        </tr>
      </thead>
      <tbody>
        ${employees
          .map(
            (employee) => `
              <tr>
                <td><strong>#${employee.id}</strong></td>
                <td>
                  <div style="font-weight: 600; color: #0f172a;">${employee.code}</div>
                  <div style="font-size: 0.85rem; color: #64748b;">${employee.fullName}</div>
                </td>
                <td>
                  <div>${employee.email}</div>
                  <div style="font-size: 0.85rem; color: #64748b;">${employee.department || '-'}</div>
                </td>
                <td>${employee.position || '-'}</td>
                <td>${employee.isSynced ? 'Yes' : 'No'}</td>
                <td><span class="pill">${employee.deletedAt ? 'DELETED' : 'ACTIVE'}</span></td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-right: 0.25rem;" data-edit-employee="${employee.id}">Sửa</button>
                  <button class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" data-remove-employee="${employee.id}">Xóa</button>
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
    <div style="margin-top: 1rem; color: #64748b; font-size: 0.85rem;">Trang ${payload.meta?.page || 1} / ${payload.meta?.totalPages || 1} - Tổng ${payload.meta?.total || 0} bản ghi</div>
  `;

  document.querySelectorAll('[data-edit-employee]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-edit-employee');
      const employee = await getJson(`/employees/${id}`);
      fillEmployeeForm(employee);
    });
  });

  document.querySelectorAll('[data-remove-employee]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-remove-employee');
      if (!confirm(`Bạn có chắc muốn xóa nhân viên #${id} không?`)) return;
      await deleteJson(`/employees/${id}`);
      await loadEmployees();
    });
  });
}

async function loadEmployees(silent = false) {
  if (!silent) employeeOutput.innerHTML = '<div style="padding: 1rem; color: #64748b;">Đang tải nhân viên...</div>';
  try {
    const payload = await getJson('/employees?limit=50&page=1');
    renderEmployees(payload);
  } catch (error) {
    if (!silent) employeeOutput.innerHTML = `<div style="color: #dc2626; padding: 1rem;">Lỗi tải dữ liệu nhân viên: ${error.message}</div>`;
  }
}

document.getElementById('saveEmployeeBtn').addEventListener('click', async () => {
  const payload = getEmployeePayload();
  const btn = document.getElementById('saveEmployeeBtn');
  const originalText = btn.textContent;
  btn.disabled = true;

  try {
    if (currentEmployeeId) {
      await patchJson(`/employees/${currentEmployeeId}`, payload);
    } else {
      await postJson('/employees', payload);
    }

    clearEmployeeForm();
    await loadEmployees();
  } catch (error) {
    alert(`Không thể lưu nhân viên: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

document.getElementById('resetEmployeeBtn').addEventListener('click', clearEmployeeForm);
document.getElementById('refreshEmployeesBtn').addEventListener('click', () => loadEmployees(false));

document.getElementById('bulkGenerateBtn').addEventListener('click', async () => {
  const count = Number(document.getElementById('employeeBulkCount').value || 0);
  if (!count) return alert('Nhập số lượng dữ liệu cần tạo.');
  await postJson('/employees/bulk-generate', { count, batchSize: 1000 });
  await loadEmployees();
});

document.getElementById('exportEmployeesBtn').addEventListener('click', async () => {
  await downloadFile('/employees/export', `employees-${Date.now()}.xlsx`);
});

document.getElementById('importEmployeesBtn').addEventListener('click', async () => {
  const input = document.getElementById('employeeImportFile');
  if (!input.files?.length) return alert('Chọn file Excel để import.');

  const formData = new FormData();
  formData.append('file', input.files[0]);

  const result = await postFormData('/employees/import', formData);
  alert(`Import xong. Thành công: ${result.inserted}, lỗi: ${result.errorCount}` + (result.errorFileUrl ? `\nFile lỗi: ${result.errorFileUrl}` : ''));
  await loadEmployees();
});

document.getElementById('uploadMinioBtn').addEventListener('click', async () => {
  const input = document.getElementById('minioUploadFile');
  if (!input.files?.length) return alert('Chọn file để upload lên MinIO.');

  const formData = new FormData();
  formData.append('file', input.files[0]);

  const result = await postFormData('/files/upload', formData);
  alert(`Upload MinIO thành công: ${result.url}`);
});

// -----------------------------------------------------------------------------
// HEALTH & SYNC
// -----------------------------------------------------------------------------
document.getElementById('runHealthCheckBtn').addEventListener('click', async () => {
  try {
    const data = await getJson('/health');
    healthOutput.innerHTML = `<pre style="white-space: pre-wrap; font-size: 0.85rem;">${JSON.stringify(data, null, 2)}</pre>`;
  } catch (error) {
    healthOutput.textContent = `Health check lỗi: ${error.message}`;
  }
});

document.getElementById('runSyncNowBtn').addEventListener('click', async () => {
  const batchSize = Number(document.getElementById('syncBatchSize').value || 1000);
  const result = await postJson(`/sync/run?batchSize=${batchSize}`, {});
  alert(`Đồng bộ xong. Scanned: ${result.scanned}, Synced: ${result.syncedCount}, Deleted: ${result.deletedCount}`);
  await loadEmployees(true);
});

document.getElementById('scheduleSyncBtn').addEventListener('click', async () => {
  const jobName = document.getElementById('syncJobName').value.trim();
  const cronExpression = document.getElementById('syncCronExpression').value.trim();
  const batchSize = Number(document.getElementById('syncBatchSize').value || 1000);
  const result = await postJson('/sync/schedule', { jobName, cronExpression, batchSize });
  alert(`Đã đặt lịch sync. Next run: ${formatDate(result.nextRun)}`);
});

// -----------------------------------------------------------------------------
// BOOTSTRAP
// -----------------------------------------------------------------------------
applyDefaultAccess();
loadTasks();
loadEmployees();

if (taskPollingInterval) clearInterval(taskPollingInterval);
taskPollingInterval = setInterval(() => loadTasks(true), 5000);

if (employeePollingInterval) clearInterval(employeePollingInterval);
employeePollingInterval = setInterval(() => loadEmployees(true), 7000);