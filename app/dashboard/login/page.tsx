"use client"

import LoginForm from "@/components/login-form"
import Image from "next/image"
import Link from "next/link"
import { LoginShell } from "@/components/login-shell"

export default function LoginPage() {
  /* Контент поверх particles; центрированная колонка — в LoginShell. */
  return (
    <LoginShell>
        {/* Лого с свечением */}
        <div className="flex flex-col items-center justify-center mb-8 sm:mb-10 animate-login-fade-down">
          <div className="relative mb-6 sm:mb-8 w-[120px] sm:w-[180px] max-w-[40vw] animate-login-float">
            {/* Зеленое свечение */}
            <div className="absolute inset-0 blur-3xl opacity-50 bg-brand/40" />
            {/* Белое свечение по контуру */}
            <div className="absolute inset-0 blur-xl opacity-30 bg-white/30" />
            <Image 
              src="/images/logo.png" 
              alt="ROSSEL 66 Logo" 
              width={180} 
              height={180} 
              className="relative w-full h-auto"
              priority
            />
          </div>
        </div>

        {/* Форма с backdrop blur */}
        <div className="animate-login-fade-up">
          <LoginForm />
        </div>

        {/* Кнопка "Вернуться на сайт" */}
        <Link 
          href="/"
          className="mt-6 sm:mt-8 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group animate-login-fade-in"
        >
          <span className="material-symbols-outlined text-base transition-transform group-hover:-translate-x-1" aria-hidden>arrow_back</span>
          Вернуться на сайт
        </Link>
    </LoginShell>
  )
}
