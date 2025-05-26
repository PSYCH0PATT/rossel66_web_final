import type React from "react"
import { ScalableSection } from "../components/ScalableSection"
import { ScalableLayout } from "../components/ScalableLayout"
import { StyledScalableSection } from "../components/styled/StyledScalableSection"
import { ResponsiveScalableSection } from "../components/ResponsiveScalableSection"
import { useScaling } from "../hooks/useScaling"
import styles from "./ExamplePage.module.css"

// Пример компонента секции с контентом
const SectionContent = () => (
  <div className={styles.sectionContent}>
    <h2>Масштабируемая секция</h2>
    <p>Этот контент будет правильно масштабироваться без обрезки.</p>
    <div className={styles.cardContainer}>
      {[1, 2, 3].map((item) => (
        <div key={item} className={styles.card}>
          <h3>Карточка {item}</h3>
          <p>Содержимое карточки, которое не будет обрезаться при масштабировании.</p>
        </div>
      ))}
    </div>
  </div>
)

// Пример использования всех компонентов
export const ExamplePage: React.FC = () => {
  // Используем хук для глобального масштабирования
  const { scale } = useScaling({
    baseWidth: 1920,
    baseHeight: 1080,
    scaleByHeight: true,
  })

  return (
    <div className={styles.pageContainer}>
      <h1>Примеры масштабируемых секций</h1>

      <h2>1. Базовый компонент ScalableSection</h2>
      <div className={styles.sectionWrapper}>
        <ScalableSection baseWidth={1600} baseHeight={900} minScale={0.6}>
          <SectionContent />
        </ScalableSection>
      </div>

      <h2>2. Компонент ScalableLayout для всей страницы</h2>
      <div className={styles.fullPageExample}>
        <ScalableLayout>
          <div className={styles.fullPageContent}>
            <h3>Полностраничный масштабируемый контент</h3>
            <p>Этот контент масштабируется вместе со всей страницей.</p>
          </div>
        </ScalableLayout>
      </div>

      <h2>3. Styled Components версия</h2>
      <div className={styles.sectionWrapper}>
        <StyledScalableSection scaleByWidth={true}>
          <SectionContent />
        </StyledScalableSection>
      </div>

      <h2>4. Адаптивная секция с сохранением пропорций</h2>
      <div className={styles.sectionWrapper}>
        <ResponsiveScalableSection padding={20}>
          <SectionContent />
        </ResponsiveScalableSection>
      </div>

      <h2>5. Использование хука useScaling напрямую</h2>
      <div className={styles.sectionWrapper}>
        <div
          className={styles.manualScalingContainer}
          style={{
            transform: `scale(${scale})`,
            width: 1600,
            height: "auto",
          }}
        >
          <SectionContent />
        </div>
      </div>
    </div>
  )
}
