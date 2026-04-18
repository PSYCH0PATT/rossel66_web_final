import { NextResponse } from "next/server";
import { getPyrusAccessToken } from "@/lib/pyrus";
import { guardPublicFormRateLimit, pyrusDataRfSchema } from "@/lib/pyrus-public-schemas";

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

const PYRUS_FORM_ID = 1553991;

export async function POST(request: Request) {
  try {
    const rl = guardPublicFormRateLimit(request);
    if (rl) return rl;

    const accessToken = await getPyrusAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { message: "Pyrus не настроен: задайте PYRUS_LOGIN и PYRUS_API_KEY в окружении." },
        { status: 500 }
      );
    }

    const rawBody: unknown = await request.json().catch(() => null);
    const validated = pyrusDataRfSchema.safeParse(rawBody);
    if (!validated.success) {
      return NextResponse.json(
        { message: "Некорректные поля формы.", details: validated.error.flatten() },
        { status: 400 }
      );
    }
    const formData: FormDataRF = validated.data as FormDataRF;

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
            message: "Форма успешно отправлена",
            taskId: responseData.task.id,
        });
    } else {
        console.error("Pyrus API error (creating task):", responseData);
        
        // Handle validation errors
        if (responseData.error && responseData.error_code === 'invalid_value_format') {
          return NextResponse.json(
            { message: "Проверьте формат заполненных полей (серия/номер паспорта, ИНН, СНИЛС)." },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
            { message: "Ошибка при отправке формы", details: responseData },
            { status: taskResponse.status }
        );
    }

  } catch (error: any) {
    console.error("Error processing Pyrus form submission:", error);
    return NextResponse.json({ message: "Ошибка при отправке формы", details: error.message ? error.message : "Неизвестная ошибка сервера" }, { status: 500 });
  }
} 