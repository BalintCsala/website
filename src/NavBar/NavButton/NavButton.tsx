import { useEffect } from "react";
import { Box } from "../../common/Box/Box";
import styles from "./NavButton.module.css";

interface Props {
    children: string;
    active?: boolean;
    shortcut: string;
    onClick: () => void;
}

export function NavButton({children, active = false, onClick, shortcut}: Props) {
    const shortcutIndex = children.toLocaleLowerCase().indexOf(shortcut);

    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLocaleLowerCase() === shortcut)
                onClick();
        };

        window.addEventListener("keydown", listener);
        return () => {
            window.removeEventListener("keydown", listener);
        };
    });
    
    return (
        <Box width={children.length} height={2} className={`${styles.button} ${active ? styles.active : ""}`}>
            <button className={styles.functionality} onClick={onClick}>
                <span>
                    {children.slice(0, shortcutIndex)}
                    <u>
                        {children.charAt(shortcutIndex)}
                    </u>
                    {children.slice(shortcutIndex + 1)}
                </span>
            </button>
        </Box>
    );
}