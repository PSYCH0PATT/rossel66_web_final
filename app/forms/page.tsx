"use client";

import type { Metadata } from 'next';
import Link from 'next/link';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { ArrowRight, User, Album, UploadCloud } from 'lucide-react';
import { SparklesCore } from '@/components/sparkles';
import { useState, useEffect, useRef } from 'react';
import { CustomCursor } from '@/components/custom-cursor';

interface CardProps {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  link?: string;
  onClick?: () => void;
  isHero?: boolean;
  color: 'emerald' | 'sky' | 'teal';
}

const springValues = { damping: 13, stiffness: 225, mass: 2 };
const springValuesFast = { damping: 13, stiffness: 225, mass: 2 };
const springValuesSlow = { damping: 39, stiffness: 75, mass: 2 };

const FormCard: React.FC<CardProps & { index: number }> = ({
  icon: Icon,
  title,
  description,
  link,
  onClick,
  isHero = false,
  color,
  index,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const rotateXFast = useSpring(0, springValuesFast);
  const rotateYFast = useSpring(0, springValuesFast);
  const rotateXSlow = useSpring(0, springValuesSlow);
  const rotateYSlow = useSpring(0, springValuesSlow);
  const scale = useSpring(1, springValuesFast);
  const [isHover, setIsHover] = useState(false);
  const [target, setTarget] = useState({ x: 0, y: 0 });

  const colorMap = {
    emerald: {
      icon: 'text-emerald-400',
      border: 'border-emerald-500/50',
      hoverBorder: 'hover:border-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    sky: {
      icon: 'text-sky-400',
      border: 'border-sky-500/50',
      hoverBorder: 'hover:border-sky-400',
      iconBg: 'bg-sky-500/10',
    },
    teal: {
      icon: 'text-teal-300',
      border: 'border-teal-500/50',
      hoverBorder: 'hover:border-teal-400',
      iconBg: 'bg-teal-500/10',
    },
  };
  const styles = colorMap[color];

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    if (!isHover) {
      const animate = () => {
        const amplitude = 6;
        const randomX = (Math.random() - 0.5) * 2 * amplitude;
        const randomY = (Math.random() - 0.5) * 2 * amplitude;
        setTarget({ x: randomX, y: randomY });
        timeout = setTimeout(animate, 2500);
      };
      animate();
    } else {
      setTarget({ x: 0, y: 0 });
      rotateXFast.set(0);
      rotateYFast.set(0);
      rotateXSlow.set(0);
      rotateYSlow.set(0);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isHover]);

  useEffect(() => {
    if (!isHover) {
      rotateXSlow.set(target.x);
      rotateYSlow.set(target.y);
    }
  }, [target, isHover, rotateXSlow, rotateYSlow]);

  function handleMouse(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    const amplitude = 18;
    const rotationX = (offsetY / (rect.height / 2)) * -amplitude;
    const rotationY = (offsetX / (rect.width / 2)) * amplitude;
    rotateXFast.set(rotationX);
    rotateYFast.set(rotationY);
  }
  function handleMouseLeave() {
    scale.set(1);
    setIsHover(false);
  }
  function handleMouseEnter() {
    setIsHover(true);
    scale.set(1.06);
  }

  const heroBg = "bg-gradient-to-br from-teal-500/20 via-neutral-900/40 to-neutral-900/40";
  const baseBg = "bg-neutral-900/40";
  const heroHoverBg = "hover:bg-teal-500/25";
  const baseHoverBg = "hover:bg-neutral-800/50";

  const motionDivProps = {
    ref,
    style: isHover
      ? { rotateX: rotateXFast, rotateY: rotateYFast, scale }
      : { rotateX: rotateXSlow, rotateY: rotateYSlow, scale },
    onMouseMove: handleMouse,
    onMouseLeave: handleMouseLeave,
    onMouseEnter: handleMouseEnter,
    className: `
      group relative w-[340px] h-[420px] 
      backdrop-blur-sm border rounded-none 
      transition-all duration-200
      ${styles.border}
      ${isHero ? `${heroBg} ${styles.hoverBorder}` : `${baseBg} ${baseHoverBg} ${styles.hoverBorder}`}
      [transform-style:preserve-3d]
    `,
  };

  const cardContent = (
    <div className="absolute inset-0 flex flex-col justify-between p-8">
      <div className="flex flex-col items-start">
        <motion.div
          className={`p-3 border border-white/10 rounded-none ${styles.iconBg} flex items-center justify-center [transform-style:preserve-3d]`}
          style={{ zIndex: 2, transform: isHover ? 'translateZ(40px)' : 'translateZ(0px)', transition: 'transform 0.18s cubic-bezier(.4,1,.4,1)' }}
        >
          <Icon className={`w-6 h-6 transition-colors ${styles.icon}`} />
        </motion.div>
        <div className="mt-6">
          <span className="block text-base text-neutral-400 tracking-widest uppercase leading-tight">
            {title.split(' ')[0]}
          </span>
          <span className="block text-3xl font-semibold text-white leading-tight uppercase">
            {title.split(' ').slice(1).join(' ')}
          </span>
          <div className="border-b border-neutral-700 w-8 my-3" />
        </div>
        <p className="text-neutral-400 mt-2 text-left">{description}</p>
      </div>
      <div className="flex items-center text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
        <span>Начать</span>
        <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>
    </div>
  );

  return link ? (
    <Link href={link} passHref>
      <div className="[perspective:800px] w-[340px] h-[420px]">
        <motion.div {...motionDivProps}>{cardContent}</motion.div>
      </div>
    </Link>
  ) : (
    <div className="[perspective:800px] w-[340px] h-[420px]">
      <motion.div {...motionDivProps} onClick={onClick}>{cardContent}</motion.div>
    </div>
  );
};

export default function FormsPage() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [showRfQuestion, setShowRfQuestion] = useState(false);

  useEffect(() => {
    document.title = 'Формы | ROSSEL 66 MUSIC';
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const cardData: CardProps[] = [
    {
      icon: User,
      title: 'Анкета артиста',
      description: 'Ваши данные — ключ к нашему партнерству. Заполните, чтобы мы могли познакомиться.',
      onClick: () => setShowRfQuestion(true),
      color: 'emerald',
    },
    {
      icon: Album,
      title: 'Перенос каталога',
      description: 'Импортируйте существующие релизы. Мы бережно перенесем ваше творчество.',
      link: '/forms/catalogUPLOAD',
      color: 'sky',
    },
    {
      icon: UploadCloud,
      title: 'Отгрузка релиза',
      description: <>Ваш релиз готов?<br/>Загрузите его, и мы займёмся остальным.</>,
      link: '/forms/releaseUPLOAD',
      isHero: true,
      color: 'teal',
    },
  ];

  return (
    <main
      className="min-h-screen flex flex-col overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative"
      style={{ fontFamily: "'Mulish', sans-serif" }}
    >
      <CustomCursor />
      <Navbar />
      <div className="h-full w-full fixed inset-0 z-0">
        <SparklesCore
          id="tsparticlesfullpage-forms"
          background="transparent"
          minSize={0.9}
          maxSize={2.1}
          particleDensity={windowSize.width < 768 ? 100 : 180}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>
      <div className={`flex flex-col ${windowSize.width > 1172 ? 'min-h-screen' : ''} justify-center items-center relative z-10${windowSize.width <= 1172 ? ' pb-12' : ''} ${windowSize.width < 768 ? 'pt-24' : ''}`}>
        <div className="container mx-auto px-4 sm:px-6 flex flex-col justify-center items-center ${windowSize.width > 1172 ? 'flex-grow' : ''}">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 md:mb-24"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
              Формы для артистов
            </h1>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">
              Три простых шага для управления вашим творчеством на нашей платформе.
            </p>
            <div className="w-20 sm:w-28 h-1 bg-gradient-to-r from-teal-500 to-sky-500 mx-auto mt-6"></div>
          </motion.div>

          <div className="flex justify-center flex-wrap items-start gap-12">
            {cardData.map((card, index) => (
              <FormCard
                key={card.title}
                index={index}
                {...card}
              />
            ))}
          </div>
        </div>
      </div>
      {showRfQuestion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          onClick={() => setShowRfQuestion(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#181818] border border-neutral-700 rounded-lg p-8 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-4">Резидентство РФ</h2>
            <p className="text-neutral-400 mb-6">Пожалуйста, выберите соответствующий вариант для корректного оформления документов.</p>
            <div className="flex flex-col space-y-3">
              <Link href="/forms/dataRF" passHref>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 px-4 text-base font-semibold rounded-lg transition-colors duration-200 bg-teal-400/20 text-teal-300 hover:bg-teal-400/30"
                >
                  Я гражданин РФ
                </motion.button>
              </Link>
              <Link href="/forms/dataNotRF" passHref>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 px-4 text-base font-semibold rounded-lg transition-colors duration-200 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                >
                  Я не гражданин РФ
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
      <Footer forceTransparentBackground={true} />
    </main>
  );
} 