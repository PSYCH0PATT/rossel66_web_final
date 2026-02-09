"use client"

import LoginForm from "@/components/login-form"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Inter } from "next/font/google"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export default function LoginPage() {
  return (
    <>
      {/* Контент поверх particles */}
      <div className={`${inter.variable} relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 font-sans`} style={{ zIndex: 10, fontFamily: 'var(--font-inter)' }}>
        <div className="relative w-full max-w-md">
        {/* Лого с свечением */}
        <div className="flex flex-col items-center justify-center mb-8 sm:mb-10 animate-fade-in-down">
          <div className="relative mb-6 sm:mb-8 w-[120px] sm:w-[180px] max-w-[40vw] animate-float">
            {/* Зеленое свечение */}
            <div className="absolute inset-0 blur-3xl opacity-50" style={{ backgroundColor: 'rgba(0, 201, 87, 0.4)' }} />
            {/* Белое свечение по контуру */}
            <div className="absolute inset-0 blur-xl opacity-30" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
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
        <div className="animate-fade-in-up">
          <LoginForm />
        </div>

        {/* Кнопка "Вернуться на сайт" */}
        <Link 
          href="/"
          className="mt-6 sm:mt-8 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group animate-fade-in"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Вернуться на сайт
        </Link>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-fade-in-down {
          animation: fadeInDown 0.8s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out 0.2s backwards;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out 0.4s backwards;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
