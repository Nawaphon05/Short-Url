export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Short-URL-Client': 'web', ...options.headers },
  });
  if (response.status === 401 && path.startsWith('/api/links')) window.dispatchEvent(new Event('session-expired'));
  return response;
}
