export type User = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  created_at: string;
};
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "CardRoute",
      ...options.headers,
    },
  });
  if (response.status === 401 && path !== "/auth/login")
    window.dispatchEvent(new Event("cardroute:unauthorized"));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.errors
        ?.map(
          (e: { field: string; message: string }) => `${e.field}: ${e.message}`,
        )
        .join(" · ") ||
        data.detail ||
        "Unable to connect. Please try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
