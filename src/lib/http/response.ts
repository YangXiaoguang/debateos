export type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, message = 'ok', init?: ResponseInit) {
  return Response.json({ success: true, data, message }, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown, init?: ResponseInit) {
  return Response.json(
    {
      success: false,
      error: { code, message, details },
    },
    { ...init, status }
  );
}
