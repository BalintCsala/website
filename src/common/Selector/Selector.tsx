import { useState } from "react";
import styles from "./Selector.module.css";

interface Props {
    id: string;
    options: {id: string, title: string}[];
    onSelect: (id: string) => void;
}

export function Selector({id, options, onSelect}: Props) {
    const [selected, setSelected] = useState(options[0]);
    const [count, setCount] = useState(0);
    const [active, setActive] = useState(false);
    
    if (count !== options.length) {
        setCount(options.length);
        setSelected(options[0]);
        onSelect(options[0].id);
    }
    
    return (
        <div className={styles.container} onClick={() => setActive(!active)}>
            <span className={styles.selected}>{selected.title}</span>
            <ul className={`${styles.dropdown} ${active ? styles.active : ""}`}>
                {options.map((option, i) => (
                    <li key={i} onClick={() => {
                        setSelected(option);
                        onSelect(option.id);
                    }}><span>{option.title}</span></li>
                ))}
            </ul>
        </div>
    );
}