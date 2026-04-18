import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getPyrusApiKey,
  getPyrusAccessToken,
  uploadFileToPyrus,
} from "@/lib/pyrus";
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas";

const MAX_PYRUS_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const rl = guardPublicFormRateLimit(request);
  if (rl) return rl;

  if (!getPyrusApiKey()) {
    return NextResponse.json(
      { message: "Ошибка сервера: Ключ API Pyrus не настроен (PYRUS_API_KEY)." },
      { status: 500 }
    );
  }

  const accessToken = await getPyrusAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Ошибка аутентификации Pyrus." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { message: "Отсутствует файл. Отправьте поле 'file' с одним файлом." },
        { status: 400 }
      );
    }

    if (typeof file.size === "number" && file.size > MAX_PYRUS_FILE_BYTES) {
      return NextResponse.json(
        { message: "Файл слишком большой (лимит 2 GB)." },
        { status: 413 }
      );
    }

    const result = await uploadFileToPyrus(file, accessToken);
    if (!result || !result.guid) {
      return NextResponse.json(
        { message: "Не удалось загрузить файл в Pyrus. Проверьте формат и размер (до 2 GB)." },
        { status: 500 }
      );
    }

    return NextResponse.json({ guid: result.guid });
  } catch (error) {
    console.error("Pyrus file upload API error:", error);
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка сервера";
    return NextResponse.json(
      { message: "Ошибка при загрузке файла.", details: message },
      { status: 500 }
    );
  }
}
