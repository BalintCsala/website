import { useLocation, useNavigate } from "react-router-dom";
import { Box } from "../common/Box/Box";
import { Color } from "../data/color";
import { NavButton } from "./NavButton/NavButton";

interface Props {
    pages: {title: string, path: string, shortcut: string}[];
}

export function NavBar({pages}: Props) {
    const navigate = useNavigate();
    const location = useLocation();
    
    return (
        <Box width={80} height={3} background={Color.Blue} padded>
            {pages.map((page, i) => (
                <NavButton 
                    shortcut={page.shortcut} 
                    key={i} 
                    active={location.pathname === page.path} 
                    onClick={() => {
                        if (page.path.startsWith("http")) {
                            window.open(page.path, "_blank")?.focus();
                        } else {
                            navigate(page.path)
                        }
                    }}>
                        {page.title}
                </NavButton>
            ))}
        </Box>  
    );
}