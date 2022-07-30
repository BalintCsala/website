import { Box } from "../../../common/Box/Box";
import { Color } from "../../../data/color";

export function About() {
    return (
        <Box width={80} height={50} background={Color.Gray} text={Color.White} borderColor={Color.Black} border padded>
            <Box width={15} />
            <Box width={46}>
                <pre>
                    &nbsp;&nbsp;___  _                 _                     <br />
                         &nbsp;/ _ \| |               | |                    <br />
                              / /_\ \ |__   ___  _   _| |_   _ __ ___   ___  <br />
                              |  _  | '_ \ / _ \| | | | __| | '_ ` _ \ / _ \ <br />
                              | | | | |_) | (_) | |_| | |_  | | | | | |  __/ <br />
                              \_| |_/_.__/ \___/ \__,_|\__| |_| |_| |_|\___| <br />
                </pre>
            </Box>
            <Box width={14} height={9} />
            <br />
            <br />
            <span>
                <u>Contact info:</u><br />
                <br />
                Email: balint.csala@gmail.com<br />
                Discord: Bálint#1673<br />
                GitHub: <a href="https://github.com/BalintCsala">https://github.com/BalintCsala</a><br />
                <br />
                <br />
                <u>Work experience:</u><br />
                <br />
                2015 - 2019: Various freelancer jobs<br />
                2019 - : Simulation developer at Ecosim<br />
                <br />
                <br />
                <u>Studies:</u><br />
                <br />
                2019 - 2022: BSc in Software Engineering at the Technical University of Budapest (BME)<br />
                <br />
                <br />
                <u>Language skills:</u><br />
                <br />
                German: Fluent<br />
                English: Fluent + Technical vocabulary<br />
                <br />
                <br />
                <u>Technological experience:</u><br />
                <br />
                JavaScript - 10 years <br />
                TypeScript - 5 years <br />
                + React - 6 years <br />
                + Vuejs - 1 year <br />
                C# - 3 years <br />
                Java - 7 years <br />
            </span>
        </Box>
    );
}