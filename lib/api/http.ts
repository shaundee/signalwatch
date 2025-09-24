import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; where?: string };

export const ok = <T>(data: T, init?: number | ResponseInit) =>
  NextResponse.json({ ok: true, data } as ApiOk<T>, typeof init === "number" ? { status: init } : init);

export const bad = (error: string, init: number = 400, where?: string) =>
  NextResponse.json({ ok: false, error, where } as ApiErr, { status: init });
