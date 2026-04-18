import { NextResponse } from 'next/server'
import { getPyrusApiKey, getPyrusAccessToken } from '@/lib/pyrus'
import { guardPublicFormRateLimit, pyrusDataNotRfSchema } from '@/lib/pyrus-public-schemas'

const PYRUS_FORM_ID = 1554517;

interface FormDataNotRF {
  nickname: string;
  telegramProfile: string;
  email: string;
  citizenship: string; // Pyrus choice_id
  otherCitizenship?: string;
  passportFullName: string;
  passportShortName: string;
  dateOfBirth: string;
  passportIdNumber: string;
  passportIssuedBy?: string;
  passportDepartmentCode?: string;
  passportIssueDate?: string;
  placeOfBirth: string;
  registrationAddress: string;
  taxId?: string;
  bankName: string;
  bankAccountNumber: string;
  bankCorrespondentAccount?: string;
  bankBik?: string;
  bankInn?: string;
  bankKpp?: string;
}

export async function POST(request: Request) {
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl

  if (!getPyrusApiKey()) {
    console.error("Pyrus API Key не настроен (PYRUS_API_KEY).");
    return NextResponse.json(
      { message: "Ошибка сервера: Ключ API Pyrus не настроен." },
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
    const rawBody: unknown = await request.json().catch(() => null)
    const validated = pyrusDataNotRfSchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json(
        { message: 'Некорректные поля формы.', details: validated.error.flatten() },
        { status: 400 }
      )
    }
    const formData: FormDataNotRF = validated.data as FormDataNotRF

    const fields = [
      { id: 1, value: formData.nickname }, // Ваш никнейм
      { id: 2, value: formData.telegramProfile }, // Ссылка на профиль в Telegram
      { id: 24, value: formData.email }, // Адрес электронной почты
      
      // Гражданство (id: 25)
      // Pyrus expects an object for multiple_choice: { choice_id: number | string }
      // If "Другое" is selected (choice_id: 16), then field 26 is also sent.
      { id: 25, value: { choice_id: parseInt(formData.citizenship, 10) } }, 
      ...(formData.citizenship === "16" && formData.otherCitizenship 
          ? [{ id: 26, value: formData.otherCitizenship }] 
          : []
      ),
      
      { id: 5, value: formData.passportFullName }, // ФИО
      { id: 6, value: formData.passportShortName }, // Кратко ФИО
      { id: 7, value: formData.dateOfBirth }, // Дата рождения (Pyrus type: date)
      { id: 8, value: formData.passportIdNumber }, // Серия и номер паспорта (удостоверения личности)
      { id: 9, value: formData.passportIssuedBy || null }, // Кем выдан
      { id: 10, value: formData.passportDepartmentCode || null }, // Код подразделения
      { id: 11, value: formData.passportIssueDate || null }, // Дата выдачи (Pyrus type: date)
      { id: 12, value: formData.placeOfBirth }, // Место рождения
      { id: 13, value: formData.registrationAddress }, // Адрес регистрации
      { id: 15, value: formData.taxId || null }, // Налоговый индификатор Вашей страны
      
      { id: 17, value: formData.bankName }, // Наименование банка
      { id: 18, value: formData.bankAccountNumber }, // Номер счёта
      { id: 19, value: formData.bankCorrespondentAccount || null }, // Корреспондентский счёт
      { id: 20, value: formData.bankBik || null }, // БИК
      { id: 21, value: formData.bankInn || null }, // ИНН банка
      { id: 22, value: formData.bankKpp || null }, // КПП банка
    ];

    // Формируем заголовок задачи, как в рабочем файле
    let taskTitle = `Заявка (НЕ РФ) от ${formData.nickname || formData.email || 'Новый пользователь'}`;
    if (formData.email && formData.nickname) {
        taskTitle = `Заявка (НЕ РФ) от ${formData.nickname} (${formData.email})`;
    }

    const pyrusTaskData = {
        form_id: PYRUS_FORM_ID, // ID текущей формы (1554517)
        fields: fields.filter(f => f.value !== null && f.value !== undefined && f.value !== ''), // Убедимся что не отправляем пустые значения
        text: taskTitle,
    };

    const pyrusResponse = await fetch(
      "https://api.pyrus.com/v4/tasks", // ИЗМЕНЕННЫЙ URL, как в рабочем файле
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pyrusTaskData), // ИЗМЕНЕННОЕ ТЕЛО ЗАПРОСА
      }
    );

    // Обработка ответа ближе к рабочему файлу
    const responseData = await pyrusResponse.json();

    if (pyrusResponse.ok && responseData && responseData.task && responseData.task.id) {
        return NextResponse.json({
            message: "Форма успешно отправлена",
            taskId: responseData.task.id,
        });
    } else {
        console.error("Pyrus API error (creating task НЕ РФ):", responseData);
        
        // Handle validation errors
        if (responseData.error && responseData.error_code === 'invalid_value_format') {
          return NextResponse.json(
            { message: "Проверьте формат заполненных полей (номер документа, налоговый ID)." },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
            { message: "Ошибка при отправке формы", details: responseData },
            { status: pyrusResponse.status || 500 }
        );
    }
  } catch (error) {
    console.error("Error processing Pyrus submission:", error);
    let simplifiedErrorMessage = "Ошибка при отправке формы";
    let errorDetails: any = "Неизвестная ошибка сервера";
    if (error instanceof Error) {
      errorDetails = error.message;
    }
    return NextResponse.json({ message: simplifiedErrorMessage, details: errorDetails }, { status: 500 });
  }
} 