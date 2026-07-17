const output = document.getElementById('output');
const taskOutput = document.getElementById('taskOutput');
const fields = ['jobName', 'minute', 'hour', 'day', 'month', 'weekday'];

function getPayload() {
  return Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
}

function getTaskPayload() {
  return {
    name: document.getElementById('taskName').value.trim(),
    cronExpression: document.getElementById('taskCronExpression').value.trim(),
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function deleteJson(url) {
  const response = await fetch(url, { method: 'DELETE' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

function renderTasks(tasks) {
  if (!tasks.length) {
    taskOutput.innerHTML = '<p class="empty-state">Chưa có task nào được lưu.</p>';
    return;
  }

  taskOutput.innerHTML = `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Tên task</th>
          <th>Cron</th>
          <th>Next run</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${tasks
          .map(
            (task) => `
              <tr>
                <td>${task.id}</td>
                <td>${task.name}</td>
                <td><code>${task.cronExpression}</code></td>
                <td>${formatDate(task.nextRun)}</td>
                <td><span class="pill">${task.status}</span></td>
                <td>
                  <button class="danger-btn" data-delete-task="${task.id}">Xóa</button>
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('[data-delete-task]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.getAttribute('data-delete-task');
      if (!confirm(`Xóa task #${id}?`)) return;
      await deleteJson(`/tasks/${id}`);
      await loadTasks();
    });
  });
}

async function loadTasks() {
  taskOutput.textContent = 'Đang tải task...';
  try {
    renderTasks(await getJson('/tasks'));
  } catch (error) {
    taskOutput.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
}

document.getElementById('validateBtn').addEventListener('click', async () => {
  try {
    output.textContent = JSON.stringify(await postJson('/cron/validate', getPayload()), null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.getElementById('scheduleBtn').addEventListener('click', async () => {
  try {
    output.textContent = JSON.stringify(await postJson('/cron/schedule', getPayload()), null, 2);
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.getElementById('createTaskBtn').addEventListener('click', async () => {
  try {
    output.textContent = JSON.stringify(await postJson('/tasks', getTaskPayload()), null, 2);
    await loadTasks();
  } catch (error) {
    output.textContent = JSON.stringify({ error: error.message }, null, 2);
  }
});

document.getElementById('refreshTasksBtn').addEventListener('click', loadTasks);

loadTasks();
