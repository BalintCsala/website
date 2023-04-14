import { JSZipObject } from "jszip";

export type FileRef<T> = {
    name: string,
    data: T,
};

export async function readFile<T>(file: JSZipObject, name: string) {
    return {
        name,
        data: JSON.parse(await file.async("string")) as T,
    };
}
