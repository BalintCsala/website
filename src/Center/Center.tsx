import { useEffect, useRef, useState } from "react";
import styles from "./Center.module.css";

const FIGURE_SPACE = " ";

interface Props {
    className?: string,
    children: string
}

export function Center({children, className = ""}: Props) {
    const ref = useRef<HTMLSpanElement>(null);
    
    const [text, setText] = useState(children);
    
    useEffect(() => {
        if (ref.current === null)
            return;
        const fontWidth = parseInt(window.getComputedStyle(ref.current).fontSize);
        const width = ref.current.clientWidth;
        if (text.length % 2 === (width / fontWidth) % 2){
            setText(text + FIGURE_SPACE);
        }
    }, [ref, text]);
    
    return (
        <span ref={ref} className={`${styles.center} ${className}`}>
            {text}
        </span>
    );
}