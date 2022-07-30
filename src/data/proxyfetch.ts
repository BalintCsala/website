const PROXY = "https://vanillashadereditor.web.app/cors/";

export function proxyfetch(url: string) {
    return fetch(PROXY + url.replace("https://", ""), {
        headers: {
            "x-requested-with": "aaa",
        },
    });
}