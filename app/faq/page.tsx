"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
// import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { SparklesCore } from "@/components/sparkles"

// Расширенный список FAQ
const faqItems = [
  {
    id: 1,
    category: "Сотрудничество",
    question: "Как начать сотрудничество с ROSSEL 66 MUSIC?",
    answer:
      "Для начала сотрудничества заполните форму обратной связи на нашем сайте. Наша команда рассмотрит вашу заявку и свяжется с вами для обсуждения деталей сотрудничества. Мы всегда открыты для новых талантов и интересных проектов.",
  },
  {
    id: 2,
    category: "Услуги",
    question: "Какие услуги предоставляет ваш лейбл?",
    answer:
      "ROSSEL 66 MUSIC предоставляет полный спектр услуг для музыкантов: дистрибуцию музыки на все цифровые площадки, продвижение релизов, таргетированную рекламу, организацию выступлений, SMM-сопровождение, продакшн (съемки клипов, фотосессии) и менеджмент. Мы помогаем артистам на всех этапах развития их карьеры.",
  },
  {
    id: 3,
    category: "Финансы",
    question: "Сколько стоят ваши услуги?",
    answer:
      "Стоимость услуг зависит от выбранного пакета и индивидуальных потребностей артиста. Мы предлагаем различные варианты сотрудничества, от базовой дистрибуции до полного продюсирования. Для получения детальной информации о ценах, пожалуйста, свяжитесь с нами через форму обратной связи.",
  },
  {
    id: 4,
    category: "Финансы",
    question: "Как происходит распределение доходов от стриминга?",
    answer:
      "Мы предлагаем прозрачную систему распределения доходов. Процент отчислений зависит от типа контракта и объема предоставляемых услуг. Все детали фиксируются в договоре, и вы всегда будете получать регулярные отчеты о прослушиваниях и доходах. Наша цель — построить долгосрочные и взаимовыгодные отношения с артистами.",
  },
  {
    id: 6,
    category: "Дистрибуция",
    question: "На какие площадки вы можете загрузить мою музыку?",
    answer:
      "Мы работаем со всеми крупными музыкальными платформами, включая Spotify, Apple Music, YouTube Music, Яндекс Музыка, VK Музыка, Zvuk, Amazon Music, Deezer, TikTok и многие другие. Ваша музыка будет доступна слушателям по всему миру.",
  },
  {
    id: 7,
    category: "Дистрибуция",
    question: "Сколько времени занимает загрузка музыки на площадки?",
    answer:
      "Обычно процесс дистрибуции занимает от 3 до 14 дней в зависимости от платформы. Некоторые сервисы, такие как Spotify и Apple Music, могут проводить дополнительную модерацию, что может увеличить время ожидания. Мы рекомендуем планировать релизы заранее, минимум за 2-3 недели до желаемой даты выхода.",
  },
  {
    id: 8,
    category: "Продвижение",
    question: "Какие методы продвижения вы используете?",
    answer:
      "Мы используем комплексный подход к продвижению, включающий работу с плейлистами, таргетированную рекламу, PR-кампании, коллаборации с другими артистами, продвижение в социальных сетях и на музыкальных платформах. Стратегия продвижения разрабатывается индивидуально для каждого артиста с учетом его стиля и целевой аудитории.",
  },
  {
    id: 9,
    category: "Продвижение",
    question: "Можете ли вы помочь с продвижением в социальных сетях?",
    answer:
      "Да, мы предоставляем полное SMM-сопровождение. Наша команда поможет с созданием контента, планированием публикаций, настройкой таргетированной рекламы и взаимодействием с аудиторией. Мы также можем помочь с разработкой стратегии продвижения в социальных сетях и анализом эффективности.",
  },
  {
    id: 10,
    category: "Контракты",
    question: "Какие типы контрактов вы предлагаете?",
    answer:
      "Мы предлагаем различные типы контрактов: дистрибуционные (для размещения музыки на платформах), лицензионные (для использования вашей музыки в различных проектах), эксклюзивные (полное сотрудничество с лейблом) и сервисные (предоставление отдельных услуг). Условия контракта обсуждаются индивидуально с каждым артистом.",
  },
  {
    id: 11,
    category: "Контракты",
    question: "Какова продолжительность контракта?",
    answer:
      "Продолжительность контракта может варьироваться от одного релиза до долгосрочного сотрудничества на несколько лет. Мы стараемся быть гибкими и учитывать пожелания артистов. Все условия, включая срок действия контракта, четко прописываются в договоре.",
  },
  {
    id: 12,
    category: "Финансы",
    question: "Как часто выплачиваются роялти?",
    answer:
      "Выплаты роялти производятся ежемесячно или ежеквартально, в зависимости от условий контракта. Мы предоставляем детальные отчеты о прослушиваниях и доходах, чтобы вы всегда были в курсе своих заработков. Прозрачность в финансовых вопросах — один из наших главных принципов.",
  },
  {
    id: 13,
    category: "Услуги",
    question: "Помогаете ли вы с созданием музыки?",
    answer:
      "Да, мы можем помочь с продюсированием треков, аранжировкой, сведением и мастерингом. У нас есть партнерские студии и профессиональные продюсеры, которые помогут довести ваш материал до высокого качества. Также мы можем организовать коллаборации с другими артистами нашего лейбла.",
  },
  {
    id: 14,
    category: "Услуги",
    question: "Можете ли вы помочь с организацией концертов?",
    answer:
      "Да, мы занимаемся организацией выступлений для наших артистов. Это включает в себя поиск площадок, переговоры с организаторами, планирование туров и продвижение мероприятий. Мы стремимся создать для вас возможности живого взаимодействия с аудиторией.",
  },
  {
    id: 15,
    category: "Сотрудничество",
    question: "Работаете ли вы с начинающими артистами?",
    answer:
      "Да, мы открыты для сотрудничества с талантливыми начинающими артистами. Мы верим в развитие новых имен в музыкальной индустрии и готовы поддержать перспективных музыкантов на старте их карьеры. Главное — это качество материала и уникальность звучания.",
  },
]

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<number[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  // Получаем уникальные категории
  const categories = Array.from(new Set(faqItems.map((item) => item.category)))

  // Фильтруем вопросы по категории
  const filteredItems = activeCategory ? faqItems.filter((item) => item.category === activeCategory) : faqItems

  // Функция для переключения состояния вопроса
  const toggleItem = (id: number) => {
    if (openItems.includes(id)) {
      setOpenItems(openItems.filter((item) => item !== id))
    } else {
      setOpenItems([...openItems, id])
    }
  }

  // Устанавливаем размеры окна при монтировании компонента
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
  }, [])

  // Обеспечиваем свободную прокрутку на странице FAQ
  useEffect(() => {
    // Сохраняем исходные стили
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    // Устанавливаем свободную прокрутку для FAQ страницы
    document.body.style.overflow = "auto"
    document.documentElement.style.overflow = "auto"
    
    // Cleanup function to restore styles properly for main page
    return () => {
      // Не устанавливаем конкретные стили при cleanup, позволяем главной странице
      // самой управлять своими стилями через CSS и SmoothScroll компонент
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      
      // Улучшенная логика реинициализации с множественными попытками
      const triggerReinitialization = () => {
        if (window.location.pathname === '/') {
          console.log('FAQ cleanup: Triggering page reinitialization');
          
          // Первая попытка реинициализации
          const event1 = new CustomEvent('pageReinitialization');
          document.dispatchEvent(event1);
          
          // Дополнительные попытки с задержкой для надежности
          setTimeout(() => {
            const event2 = new CustomEvent('pageReinitialization');
            document.dispatchEvent(event2);
            console.log('FAQ cleanup: Second reinitialization attempt');
          }, 200);
          
          setTimeout(() => {
            const event3 = new CustomEvent('pageReinitialization');
            document.dispatchEvent(event3);
            console.log('FAQ cleanup: Third reinitialization attempt');
          }, 500);
          
          // Принудительная проверка высоты секций
          setTimeout(() => {
            const servicesSection = document.getElementById('services');
            const artistsSection = document.getElementById('artists');
            const expectedHeight = window.innerHeight * 2;
            
            if (servicesSection) {
              const currentHeight = servicesSection.offsetHeight;
              if (Math.abs(currentHeight - expectedHeight) > 50) {
                console.log(`FAQ cleanup: Services section height correction needed. Current: ${currentHeight}, Expected: ${expectedHeight}`);
                servicesSection.style.height = `${expectedHeight}px`;
                servicesSection.style.minHeight = `${expectedHeight}px`;
                servicesSection.style.overflow = 'visible';
                servicesSection.style.position = 'relative';
              }
            }
            
            if (artistsSection) {
              const currentHeight = artistsSection.offsetHeight;
              if (Math.abs(currentHeight - expectedHeight) > 50) {
                console.log(`FAQ cleanup: Artists section height correction needed. Current: ${currentHeight}, Expected: ${expectedHeight}`);
                artistsSection.style.height = `${expectedHeight}px`;
                artistsSection.style.minHeight = `${expectedHeight}px`;
                artistsSection.style.overflow = 'visible';
                artistsSection.style.position = 'relative';
              }
            }
            
            // КРИТИЧЕСКИ ВАЖНО: Сбрасываем позицию прокрутки контейнера
            const scrollHost = document.querySelector('.sections-scroll-host') as HTMLElement | null;
            if (scrollHost) {
              console.log(`FAQ cleanup: Resetting scroll position. Current: ${scrollHost.scrollTop}`);
              scrollHost.style.scrollBehavior = 'auto';
              scrollHost.scrollTop = 0; // Принудительно сбрасываем к началу
              
              setTimeout(() => {
                if (scrollHost) {
                  scrollHost.style.scrollBehavior = 'smooth';
                  console.log(`FAQ cleanup: Scroll position reset complete. New position: ${scrollHost.scrollTop}`);
                }
              }, 50);
            }
          }, 600);
        }
      };
      
      // Добавляем небольшую задержку для корректной инициализации главной страницы
      setTimeout(triggerReinitialization, 100);
    }
  }, [])

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden bg-black/[0.96] antialiased bg-grid-white/[0.02] relative">
      {/* Ambient background with moving particles */}
      <div className="h-full w-full fixed inset-0 z-0">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.9}
          maxSize={2.1}
          particleDensity={windowSize.width < 768 ? 120 : 195}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>

      <div className="relative z-10">
        {/* <Navbar /> */}

        <div 
          className="container mx-auto px-4 sm:px-6 pb-16" 
          style={{ paddingTop: '3rem' }}
        >
          <div className="flex items-center mb-8">
            <Link href="/">
              <Button variant="ghost" className="text-white p-2">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Вернуться на главную
              </Button>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Часто задаваемые вопросы</h1>
            <div className="w-16 sm:w-24 h-1 bg-emerald-500 mx-auto mb-8"></div>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto">
              Здесь вы найдете ответы на самые распространенные вопросы о работе с нашим лейблом
            </p>
          </motion.div>

          {/* Фильтр по категориям */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <Button
              onClick={() => setActiveCategory(null)}
              className={`rounded-full px-4 py-2 ${
                activeCategory === null ? "bg-emerald-500 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              Все вопросы
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-4 py-2 ${
                  activeCategory === category
                    ? "bg-emerald-500 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>

          {/* Список FAQ */}
          <div className="max-w-4xl mx-auto space-y-4 mb-16">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="glass-card bg-white/5 overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full flex justify-between items-center p-5 text-left"
                >
                  <div>
                    <span className="text-xs font-medium text-emerald-400 mb-1 block">{item.category}</span>
                    <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                  </div>
                  {openItems.includes(item.id) ? (
                    <ChevronUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  )}
                </button>

                <div
                  className={`px-5 overflow-hidden transition-all duration-300 ${
                    openItems.includes(item.id) ? "max-h-96 pb-5" : "max-h-0"
                  }`}
                >
                  <p className="text-gray-300">{item.answer}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Не нашли ответ */}
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Не нашли ответ на свой вопрос?</h3>
            <p className="text-gray-300 mb-6">
              Свяжитесь с нами через форму обратной связи, и мы с радостью ответим на все ваши вопросы
            </p>
            <Link href="/#contact">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.31)] transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.44)]">
                Связаться с нами
              </Button>
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  )
}
