// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

// Mock server-only so it doesn't throw in test environment
vi.mock("server-only", () => ({}));

// Track cookie store calls
const mockSet = vi.fn();
const mockCookieStore = { set: mockSet };
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

beforeEach(() => {
  mockSet.mockClear();
});

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

test("createSession sets an httpOnly cookie", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-123", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [cookieName, , options] = mockSet.mock.calls[0];
  expect(cookieName).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
});

test("createSession sets a sameSite lax cookie", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-123", "test@example.com");

  const [, , options] = mockSet.mock.calls[0];
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession cookie expires in ~7 days", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const [, , options] = mockSet.mock.calls[0];
  const expires: Date = options.expires;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession stores a valid JWT with userId and email", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-123", "test@example.com");

  const [, token] = mockSet.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
});

test("createSession JWT expires in 7 days", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-123", "test@example.com");

  const [, token] = mockSet.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  const sevenDaysSec = 7 * 24 * 60 * 60;
  expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysSec - 5);
  expect(payload.exp).toBeLessThanOrEqual(before + sevenDaysSec + 5);
});
