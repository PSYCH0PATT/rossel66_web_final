import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  PYRUS_API_KEY,
  getPyrusAccessToken,
  uploadFileToPyrus,
} from "@/lib/pyrus";

export async function POST(request: NextRequest) {
  if (!PYRUS_API_KEY) {
    return NextResponse.json(
      { message: "Ошибка сервера: Ключ API Pyrus не настроен." },
      { status: 500 }
    );
  }

  const accessToken = await getPyrusAccessToken(PYRUS_API_KEY);
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
