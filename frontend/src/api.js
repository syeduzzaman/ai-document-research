export async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const { detail } = await response.json().catch(() => ({}));
    const message = typeof detail === "string" ? detail
      : Array.isArray(detail) ? detail.map((item) => item.msg).join(". ")
        : "The request failed. Please try again.";
    throw new Error(message);
  }
  return response.status === 204 ? undefined : response.json();
}

export function sendJson(path, method, payload) {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
