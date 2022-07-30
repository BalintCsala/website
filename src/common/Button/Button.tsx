import styles from "./Button.module.css";

interface Props {
    title: string;
    onClick: () => void;
}

export function Button({ title, onClick }: Props) {
    return (
        <button onClick={onClick} className={styles.button}>
            {title}
        </button>
    );
}