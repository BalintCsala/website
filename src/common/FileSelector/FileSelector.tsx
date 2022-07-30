import { useRef, useState } from "react";
import styles from "./FileSelector.module.css";

interface Props {
    id: string;
    extension: string;
    onSelect: (file: File | null) => void;
}

export function FileSelector({ id, extension, onSelect }: Props) {
    const [selected, setSelected] = useState<File | null>(null);
    const ref = useRef<HTMLInputElement>(null);
    
    let displayName = (selected?.name ?? "");
    if (displayName.length > 30) {
        displayName = displayName.slice(0, 27) + "...";
    }
    
    return (
        <>
            <input onChange={e => {
                    const file = (e.target.files ?? [])[0] ?? null;
                    setSelected(file);
                    onSelect(file);
                }} ref={ref} className={styles.input} accept={`.${extension}`} type="file" id={id} />
            <span className={styles.display} onClick={() => ref.current?.click()}>{selected ? displayName : "Click here to select a file..."}</span>
        </>
    );
}