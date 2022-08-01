import { useState } from "react";
import styles from "./TextField.module.css";

interface Props {
    onChange: (value: string) => void;
}

export function TextField({ onChange }: Props) {
    const [value, setValue] = useState("");
    
    return (
        <input className={styles.textField} value={value} type="text" onChange={e => {
            onChange(e.target.value);
            setValue(e.target.value);
        }} />
    );
}