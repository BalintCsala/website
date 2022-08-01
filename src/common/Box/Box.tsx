import React, { useEffect, useRef, useState } from "react";

import { Color } from "../../data/color";
import styles from "./Box.module.css";

interface Props {
    className?: string;
    border?: boolean;
    title?: string;
    width: number;
    minHeight?: number;
    height?: number;
    children?: React.ReactNode;
    background?: Color;
    text?: Color;
    padded?: boolean;
    scrollable?: boolean;
    borderColor?: Color;
}

export function Box({className = "", border = false, scrollable = false, title, width, minHeight, height, children, background, borderColor, text, padded = false}: Props) {
    const hasTitle = title !== undefined;
    const actualTitle = width % 2 === (title?.length ?? 0) % 2 ? title : title + " ";
    const ref = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    
    const bColor = borderColor ?? text ?? "";

    const [scrollOffset, setScrollOffset] = useState(0);
    
    const contentHeight = contentRef.current?.offsetHeight ?? 0;
    const fontSize = parseInt(contentRef.current ? window.getComputedStyle(contentRef.current).fontSize : "0");
    const charHeight = contentHeight / fontSize;
    
    useEffect(() => {
        if (!scrollable || !height)
            return;
        const handler = (e: WheelEvent) => {
            setScrollOffset(Math.max(Math.min(scrollOffset + e.deltaY / 100.0 * 3.0, charHeight - height + 1), 0));
        };
        const elem = ref.current;
        if (elem) {
            elem.addEventListener("wheel", handler);
            return () => elem.removeEventListener("wheel", handler);
        }
    }, [charHeight, height, scrollOffset, scrollable]);
    
    
    let leading = 0;
    let knobSize = 0;

    if (height) {
        const newVisiblePercentage = (height - 1) / charHeight;
        const freeSpace = Math.floor((height - 4) * (1 - newVisiblePercentage));
        
        leading = Math.floor(freeSpace * (scrollOffset / (charHeight - height - 1)));
        leading = Math.max(leading, 0);
        knobSize = Math.min((height - 4) - freeSpace, height - 4 - (padded ? 7 : 0));
    }
    
    return (
        <div ref={ref} className={`${styles.box} ${className}`} style={{
                width: `${width}ch`, 
                minHeight: minHeight ? `${minHeight}ch` : "auto",
                height: height ? `${height}ch` : "auto",
                backgroundColor: background ? `var(--${background})` : "",
                color: text ? `var(--${text})` : "",
            }}>
            {border ? (
                <>
                    <div className={styles.topBorder} style={{color: bColor ? `var(--${bColor})` : ""}}>╔{"═".repeat(width - 2)}╗</div>
                    <div className={styles.leftBorder} style={{color: bColor ? `var(--${bColor})` : ""}}>{(hasTitle ? "║╟║" : "") +  "║".repeat(500)}</div>
                </>
            ) : null}
            <div className={`${styles.innerBox} ${border ? styles.bordered : ""}`}>
                {hasTitle ? (
                    <>
                        <span className={styles.title}>{actualTitle}</span>
                        <div className={styles.divider}>{"─".repeat(width - 2)}</div>
                    </>
                ) : null}
                <div ref={contentRef} style={{marginTop: `${-scrollOffset}ch`}} className={`${styles.content} ${(padded) ? styles.padded : ""} ${scrollable ? styles.scrollable : ""}`}> 
                    {children}
                </div>
            </div>
            {scrollable ? (
                <div className={styles.scrollBar} style={{color: bColor ? `var(--${bColor})` : ""}}>
                    ▲
                    {"░".repeat(leading)}
                    {"█".repeat(knobSize)}
                    {"░".repeat(Math.max(((height ?? 50) - 4) - leading - knobSize, 0))}
                    ▼
                </div>
            ) : null}
            {border ? (
                <>
                    <div className={styles.rightBorder} style={{color: bColor ? `var(--${bColor})` : ""}}>{(hasTitle ? "║╢║" : "") + "║".repeat(60)}</div>
                    <div className={styles.bottomBorder} style={{color: bColor ? `var(--${bColor})` : ""}}>╚{"═".repeat(width - 2)}╝</div>
                </>
            ) : null}
        </div>
    );
}