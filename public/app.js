const output = document.getElementById('output');
const fields = ['jobName', 'minute', 'hour', 'day', 'month', 'weekday'];

function getPayload() {
  return Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
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
