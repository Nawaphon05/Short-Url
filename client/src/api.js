export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Short-URL-Client': 'web', ...options.headers },
  });
  if (!response.ok && !response.headers.get('content-type')?.includes('application/json')) {
    const error = new Error('บริการยังไม่พร้อมใช้งาน กรุณารีเฟรชหน้าเว็บหรือติดต่อผู้ดูแล');
    error.serviceUnavailable = true;
    throw error;
  }
  if (response.status === 401 && path.startsWith('/api/links')) window.dispatchEvent(new Event('session-expired'));
  return response;
}
