const taskOutput = document.getElementById('taskOutput');

// Biến lưu bộ đếm làm mới tự động (Polling Intervals)
let logPollingInterval = null;
let taskPollingInterval = null;

function getTaskPayload() {
  return {
    name: document.getElementById('taskName').value.trim(),
    cronExpression: document.getElementById('taskCronExpression').value.trim(),
    recipientEmail: document.getElementById('taskRecipientEmail').value.trim(),
    subject: document.getElementById('taskSubject').value.trim(),
    content: document.getElementById('taskContent').value.trim(),
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

async function deleteJson(url) {
  const response = await fetch(url, { method: 'DELETE' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

async function getJson(url) {
  // Thêm timestamp vào URL để chống cache tuyệt đối
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}_t=${Date.now()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại');
  return data;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return `${date.toLocaleTimeString('vi-VN')} - ${date.toLocaleDateString('vi-VN')}`;
}

// -------------------------------------------------------------
// LOGIC MODAL XEM LỊCH SỬ LOG (TỰ ĐỘNG CẬP NHẬT MỖI 2 GIÂY)
// -------------------------------------------------------------
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
  document.getElementById('modalLogContent').innerHTML = '<p>Đang lấy dữ liệu từ SQLite...</p>';
  logModal.style.display = 'block';

  fetchAndRenderLogs(taskId);

  if (logPollingInterval) clearInterval(logPollingInterval);
  logPollingInterval = setInterval(() => {
    if (logModal.style.display === 'block') {
      fetchAndRenderLogs(taskId);
    }
  }, 2000);
}

// -------------------------------------------------------------
// RENDER DANH SÁCH TASKS (TỰ ĐỘNG LÀM MỚI MỖI 5 GIÂY)
// -------------------------------------------------------------
function renderTasks(tasks) {
  if (!tasks.length) {
    taskOutput.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">Chưa có tác vụ lập lịch nào. Hãy tạo mới ở biểu mẫu phía trên!</div>';
    return;
  }

  taskOutput.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Tác Vụ & Người Nhận</th>
          <th>Chu Kỳ Cron</th>
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
      if (!confirm(`Bạn có chắc muốn xóa tác vụ #${id} khỏi hệ thống không?`)) return;
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
    // Reset nhẹ ô tiêu đề để lần tạo sau không trùng
    document.getElementById('taskSubject').value = 'Thông báo từ hệ thống tự động';
  } catch (error) {
    alert(`Không thể tạo tác vụ: ${error.message}`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

document.getElementById('refreshTasksBtn').addEventListener('click', () => loadTasks(false));

// Khởi chạy lần đầu và bật tự động cập nhật danh sách mỗi 5 giây
loadTasks();
if (taskPollingInterval) clearInterval(taskPollingInterval);
taskPollingInterval = setInterval(() => loadTasks(true), 5000);