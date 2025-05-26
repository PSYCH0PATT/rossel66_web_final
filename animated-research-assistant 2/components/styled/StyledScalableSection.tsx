"use client"

import type React from "react"
import { useRef } from "react"
import styled from "styled-components"
import { useScaling } from "../../hooks/useScaling"

interface StyledScalableSectionProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  scaleByWidth?: boolean
  scaleByHeight?: boolean
  className?: string
}

// Стилизованные компоненты
const Container = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
`

const Content = styled.div<{ scale: number }>`
  position: relative;
  transform-origin: center center;
  transform: ${({ scale }) => `scale(${scale})`};
  transition: transform 0.3s ease;
  overflow: visible;
  
  /* Предотвращаем обрезку дочерних элементов */
  & > * {
    overflow: visible;
  }
`

export const StyledScalableSection: React.FC<StyledScalableSectionProps> = ({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  scaleByWidth = false,
  scaleByHeight = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Используем хук для расчета масштаба
  const { scale } = useScaling({
    baseWidth,
    baseHeight,
    minScale,
    maxScale,
    scaleByWidth,
    scaleByHeight,
  })

  return (
    <Container ref={containerRef} className={className}>
      <Content
        scale={scale}
        style={{
          width: baseWidth,
          height: baseHeight,
        }}
      >
        {children}
      </Content>
    </Container>
  )
}
