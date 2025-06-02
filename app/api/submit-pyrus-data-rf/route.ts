import { NextResponse } from "next/server";

// Интерфейс для данных, приходящих с фронтенда
interface FormDataRF {
  nickname: string;
  telegramProfile: string;
  email: string;
  passportFullName: string;
  passportShortName: string;
  dateOfBirth: string; // Формат YYYY-MM-DD
  passportSeriesNumber: string;
  passportIssuedBy: string;
  passportIssueDate: string; // Формат YYYY-MM-DD
  passportDepartmentCode: string;
  placeOfBirth: string;
  registrationAddress: string;
  snils: string;
  inn: string;
  bankName: string;
  bankAccountNumber: string;
  bankCorrespondentAccount: string;
  bankBik: string;
  bankInn: string;
  bankKpp: string;
}

const PYRUS_FIELD_IDS = { // Этот блок должен быть АКТИВНЫМ и содержать ваши реальные ID полей
  nickname: "1", 
  telegramProfile: "2",
  email: "24",
  passportFullName: "6",
  passportShortName: "7",
  dateOfBirth: "8",
  passportSeriesNumber: "9",
  passportIssuedBy: "10",
  passportIssueDate: "11",
  passportDepartmentCode: "13",
  placeOfBirth: "12",
  registrationAddress: "14",
  snils: "15",
  inn: "16",
  bankName: "18",
  bankAccountNumber: "19",
  bankCorrespondentAccount: "20",
  bankBik: "21",
  bankInn: "22",
  bankKpp: "23",
};

const PYRUS_LOGIN = "rossel66.music@gmail.com";
const PYRUS_SECURITY_KEY = process.env.PYRUS_API_KEY; // Возвращаем чтение из process.env
// const PYRUS_SECURITY_KEY = "HxiuebPcNiPfJLM7wGDHI~8BgKzZbZ3KqhCJhr52f8QvLhdiHGI4dGNLYxCGXB-beBsOnh7yvTS6M8z6V2PnwNnZ6DX7DQ4w"; // Комментируем временный ключ
const PYRUS_FORM_ID = 1553991;

async function getPyrusAccessToken() {
  if (!PYRUS_SECURITY_KEY) {
    console.error("Pyrus Security Key (PYRUS_API_KEY in .env.local) is not configured.");
    throw new Error("Ошибка конфигурации сервера: Секретный ключ Pyrus не найден.");
  }

  const authResponse = await fetch("https://accounts.pyrus.com/api/v4/auth/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      login: PYRUS_LOGIN,
      security_key: PYRUS_SECURITY_KEY,
    }),
  });

  if (!authResponse.ok) {
    let errorData;
    try {
      errorData = await authResponse.json();
    } catch (e) {
        // Если тело ответа не JSON, или пустое
        errorData = { error: "Unknown Pyrus auth error", details: await authResponse.text() };
    }
    console.error("Pyrus auth error:", errorData);
    throw new Error(errorData.error_description || errorData.error || `Ошибка аутентификации Pyrus: ${authResponse.status}`);
  }

  const authData = await authResponse.json();
  if (!authData.access_token) {
    console.error("Pyrus auth response did not contain access_token:", authData);
    throw new Error("Не удалось получить access_token от Pyrus.");
  }
  return authData.access_token;
}

export async function POST(request: Request) {
  try {
    const accessToken = await getPyrusAccessToken();

    const formData: FormDataRF = await request.json();

    const pyrusFields = Object.entries(formData)
      .map(([key, value]) => {
        const fieldId = PYRUS_FIELD_IDS[key as keyof typeof PYRUS_FIELD_IDS];
        if (fieldId && value && fieldId.startsWith("FIELD_ID_") === false) { // Добавил проверку, что ID был заменен
          return { id: fieldId, value: value };
        }
        return null;
      })
      .filter((field) => field !== null) as { id: string; value: any }[]; // Уточнил тип

    if (pyrusFields.length === 0) {
      // Это может произойти, если PYRUS_FIELD_IDS не заполнены реальными значениями
      console.warn("No Pyrus fields to submit. Check PYRUS_FIELD_IDS configuration.");
      return NextResponse.json(
        { message: "Нет данных для отправки в Pyrus. Проверьте конфигурацию ID полей." },
        { status: 400 }
      );
    }

    let taskTitle = `Заявка от ${formData.nickname || formData.passportShortName || 'Новый пользователь'}`;
    if (formData.email) {
        taskTitle += ` (${formData.email})`;
    }

    const pyrusTaskData = {
      form_id: PYRUS_FORM_ID,
      fields: pyrusFields,
      text: taskTitle,
    };

    const taskResponse = await fetch("https://api.pyrus.com/v4/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(pyrusTaskData),
    });

    const responseData = await taskResponse.json();

    if (taskResponse.ok && responseData && responseData.task) {
        return NextResponse.json({
            message: "Данные успешно отправлены в Pyrus!",
            taskId: responseData.task.id,
        });
    } else {
        console.error("Pyrus API error (creating task):", responseData);
        let errorMessage = "Ошибка при отправке данных в Pyrus.";
        if (responseData && responseData.error_description) {
            errorMessage = responseData.error_description;
        } else if (responseData && responseData.error) {
            errorMessage = responseData.error;
        }
        return NextResponse.json(
            { message: errorMessage, details: responseData },
            { status: taskResponse.status }
        );
    }

  } catch (error: any) {
    console.error("Error processing Pyrus form submission:", error);
    let message = "Внутренняя ошибка сервера.";
    if (error instanceof Error) {
        message = error.message;
    }
    // Если ошибка пришла из getPyrusAccessToken, она уже содержит информативное сообщение
    return NextResponse.json({ message }, { status: 500 });
  }
} 