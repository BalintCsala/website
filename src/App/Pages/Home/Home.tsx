import { Box } from "../../../common/Box/Box";
import { Color } from "../../../color";
import { Photo } from "./Photo/Photo";

export function Home() {
    return (
        <Box width={80} height={50} background={Color.Gray} text={Color.White} borderColor={Color.Black} border padded>
            <Box width={24} />
            <Box width={28}> 
                <pre>
                    &nbsp;_   _                       <br />                  
                         | | | |                      <br />  
                         | |_| | ___  _ __ ___   ___  <br />
                         |  _  |/ _ \| '_ ` _ \ / _ \ <br />
                         | | | | (_) | | | | | |  __/ <br />
                         \_| |_/\___/|_| |_| |_|\___| <br />
                </pre>   
            </Box>    
            <br />
            <br />
            <Box width={38}>
                Hi!<br />
                <br />
                Welcome to my webpage on the World Wide Web™!<br />
                <br />
                My name is Bálint Csala, I'm a freelancer frontend web developer. I've been in this industry as a hobby for 10 years and have been working professionally for 6.<br />
                <br />
                I'm also deep into computer graphics (OpenGL, Vulkan, shader stuff, etc.)<br />
                <br />
                If you'd like to contact me, please<br />
                read the About me page.
            </Box>
            <Photo />
        </Box>
    );
}