type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  error?: {
    message?: string;
  };
};

export async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Request failed.');
  }

  return payload.data;
}
