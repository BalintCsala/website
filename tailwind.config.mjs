/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
        fontFamily: {
            sans: ["BIOS", "monospace"]
        },
        colors: {
            black: "#000000",
            gray: "#707070",
            silver: "#C4C4C4",
            white: "#FFFFFF",
            red: "#FF0000",
            maroon: "#800000",
            blue: "#0000FF",
            navy: "#000080",
            green: "#008000",
            lime: "#00FF00",
            yellow: "#FFFF00",
            olive: "#808000",
            teal: "#008080",
            cyan: "#00FFFF",
            purple: "#800080",
            magenta: "#FF00FF",
        }
	},
	plugins: [],
}
