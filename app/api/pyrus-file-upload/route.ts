import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas";
import { legacyPyrusFileUploadGoneBody } from "@/lib/buildin/legacy-form-cutover";

export async function POST(request: NextRequest) {
  const rl = guardPublicFormRateLimit(request);
  if (rl) return rl;

  return NextResponse.json(legacyPyrusFileUploadGoneBody, { status: 410 });
}
