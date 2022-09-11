interface Props {
    progress: number;
    width: number;
}

export function ProgressBar({ progress, width }: Props) {
    const filledChars = Math.floor(width * progress);
    return (
        <span>
           {"#".repeat(filledChars)}
           {".".repeat(width - filledChars)} 
        </span>
    );
}