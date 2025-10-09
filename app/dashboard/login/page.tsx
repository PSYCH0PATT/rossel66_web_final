import LoginForm from "@/components/login-form"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-white" style={{ position: 'relative', zIndex: 1 }}>
      {/* Черный overlay с прозрачностью 0.96 - particles будут из layout лендинга */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.96)', zIndex: -1 }} />

      {/* Контент поверх фона */}
      <div className="relative w-full max-w-md space-y-8" style={{ zIndex: 2 }}>
        <div className="flex flex-col items-center justify-center">
          <Image src="/images/logo.png" alt="ROSSEL 66 Logo" width={200} height={200} className="mb-6" />
          <h1 className="text-3xl font-bold text-white">ROSSEL 66</h1>
          <p className="mt-2 text-center text-sm text-gray-400">Доступ к личному кабинету только для артистов лейбла</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
