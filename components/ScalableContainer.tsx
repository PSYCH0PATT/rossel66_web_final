"use client"

import type React from "react"
import { useRef, useEffect } from "react"
import { useScaling } from "@/hooks/useScaling"
import { useMobileDetector } from "@/hooks/use-mobile-detector"

interface ScalableContainerProps {
  children: React.ReactNode
  baseWidth?: number
  baseHeight?: number
  minScale?: number
  maxScale?: number
  scaleByHeight?: boolean
  className?: string
  isMobileProp?: boolean
}

export default function ScalableContainer({
  children,
  baseWidth = 1920,
  baseHeight = 1080,
  minScale = 0.5,
  maxScale = 1.2,
  scaleByHeight = true,
  className = "",
  isMobileProp,
}: ScalableContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const localIsMobile = useMobileDetector()

  const isMobile = typeof isMobileProp === 'boolean' ? isMobileProp : localIsMobile;

  const { scale: hookScale, dimensions } = useScaling({
    baseWidth,
    baseHeight,
    minScale,
    maxScale,
    scaleByHeight,
  })

  useEffect(() => {
    if (contentRef.current && dimensions.width > 0 && dimensions.height > 0) {
      let finalAppliedScale: number;

      if (isMobile) {
        finalAppliedScale = dimensions.width / baseWidth;
        finalAppliedScale = Math.max(finalAppliedScale, minScale);
      } else {
        finalAppliedScale = hookScale;
      }

      contentRef.current.style.width = `${baseWidth}px`;
      
      contentRef.current.style.left = "50%";
      contentRef.current.style.transform = `translate(-50%, 0) scale(${finalAppliedScale})`;
      contentRef.current.style.transformOrigin = "center top";
      
      contentRef.current.style.top = "0";

      document.documentElement.style.setProperty("--content-scale", finalAppliedScale.toString());
      contentRef.current.classList.add("scale-applied");
      contentRef.current.setAttribute("data-scale", finalAppliedScale.toString());
      document.documentElement.style.setProperty("--inverse-scale", `${1 / finalAppliedScale}`);

      const scaleEvent = new CustomEvent("scalechange", { detail: { scale: finalAppliedScale } });
      document.dispatchEvent(scaleEvent);
    }
  }, [hookScale, dimensions.width, dimensions.height, isMobile, baseWidth, minScale]);

  useEffect(() => {
    const handleScroll = () => {
      const footer = document.getElementById("footer")
      if (footer) {
        const footerRect = footer.getBoundingClientRect()
        const windowHeight = window.innerHeight
        
        if (footerRect.bottom <= windowHeight) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight - windowHeight,
              behavior: "auto"
            })
          })
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: false })
    
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <div
      className={`scalable-container ${className}`}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div
        ref={contentRef}
        className="scalable-content"
        style={{
          height: "auto",
          position: "absolute",
          top: 0,
          overflow: "visible",
        }}
      >
        {children}
      </div>
    </div>
  )
}
