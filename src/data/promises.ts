export async function waitForReader<T extends string | ArrayBuffer>(reader: FileReader): Promise<T> {
    return new Promise(resolve => {
        reader.onload = () => resolve(reader.result as T);
    });
}

export async function waitForImageLoad(img: HTMLImageElement): Promise<null> {
    return new Promise(resolve => {
        img.onload = () => resolve(null);
    });
}
