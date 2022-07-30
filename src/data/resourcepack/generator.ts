import JSZip from "jszip";
import PNG from "png-ts";
import blockDatas from "./block_data.json";

const MIN_IMAGE_SIZE = 16;
const POS_BITS = 11;

const ATLAS_GRID_SIZE = 2 ** POS_BITS;

interface BlockData {
    name: string;
    model: "cube" | "same_sides";
    textures: { [key: string]: string };
}

const MODEL_TEXTURES = {
    cube: ["texture"],
    same_sides: ["top", "bottom", "side"]
};

async function waitForReader(reader: FileReader): Promise<ArrayBuffer> {
    return new Promise(resolve => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
    });
}

function get(atlas: boolean[], x: number, y: number) {
    return atlas[x + y * ATLAS_GRID_SIZE] ?? false;
}

function set(atlas: boolean[], x: number, y: number) {
    atlas[x + y * ATLAS_GRID_SIZE] = true;
}

function findPlaceInAtlas(atlas: boolean[], textures: PNG[], size: number): [number, number] {
    const cellWidth = (textures.length * size) / MIN_IMAGE_SIZE;
    const cellHeight = size / MIN_IMAGE_SIZE;
    for (let i = 0; i < ATLAS_GRID_SIZE; i++) {
        for (let j = 0; j < 2 * i + 1; j++) {
            let x = Math.min(j, i);
            let y = i - Math.max(j - i, 0);
            let foundX = true;
            for (let dx = 0; dx < cellWidth; dx++) {
                let foundY = true;
                for (let dy = 0; dy < cellHeight; dy++) {
                    if (get(atlas, x + dx, y + dy)) {
                        foundY = false;
                        break;
                    }
                }
                if (!foundY) {
                    foundX = false;
                    break;
                }
            }
            if (foundX) {
                for (let dx = 0; dx < cellWidth; dx++) {
                    for (let dy = 0; dy < cellHeight; dy++) {
                        set(atlas, x + dx, y + dy);
                    }
                }
                return [x, y];
            }
        }
    }

    return [-1, -1];
}

function createDataTexture(x: number, y: number, size: number, zip: JSZip, block: string): Promise<boolean> {
    let sizeData = Math.floor(Math.log2(size / MIN_IMAGE_SIZE));
    let index = x | (y << POS_BITS) | (sizeData << (POS_BITS + POS_BITS));

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!!;
    ctx.fillStyle = `rgb(${[index & 0xFF, (index >> 8) & 0xFF, index >> 16]})`;
    ctx.fillRect(0, 0, 1, 1);
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            zip.folder("assets/minecraft/textures/block")
                ?.file(`${block}_data.png`, blob?.arrayBuffer()!!, { binary: true });
            resolve(true);
        });
    });
};

function createAtlas(placedTextures: { x: number; y: number; textures: PNG[]; }[], largestX: number, largestY: number): Promise<ArrayBuffer> {
    const size = 2 ** (Math.ceil(Math.log2(Math.max(largestX, largestY)))) * MIN_IMAGE_SIZE;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!!;
    const imageData = ctx.getImageData(0, 0, size, size);

    for (let { x, y, textures } of placedTextures) {
        let posX = x * MIN_IMAGE_SIZE;
        let posY = y * MIN_IMAGE_SIZE;
        for (let texture of textures) {
            const data = texture.decodePixels();
            for (let dx = 0; dx < texture.width; dx++) {
                for (let dy = 0; dy < texture.height; dy++) {
                    const ctxtIndex = ((posX + dx) + (posY + dy) * size) * 4;
                    const index = (dx + dy * texture.width) * 4;
                    imageData.data[ctxtIndex + 0] = data[index + 0];
                    imageData.data[ctxtIndex + 1] = data[index + 1];
                    imageData.data[ctxtIndex + 2] = data[index + 2];
                    imageData.data[ctxtIndex + 3] = data[index + 3];
                }
            }
            posX += texture.width;
        }
    }
    ctx.putImageData(imageData, 0, 0);

    return new Promise(resolve => {
        canvas.toBlob(blob => blob?.arrayBuffer()
            .then(buffer => resolve(buffer)));
    });
}

export async function generateResourcepack(jar: File, file: File) {
    const rpName = file.name.replace(".zip", "");

    console.log("Reading resourcepack...");
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    const rawResourcepackData = await waitForReader(reader);
    const resourcepackZip = await JSZip.loadAsync(rawResourcepackData);
    console.log("Successfully read resourcepack");
    console.log("Reading version jar...");
    reader.readAsArrayBuffer(jar);
    const rawJarData = await waitForReader(reader);
    const jarZip = await JSZip.loadAsync(rawJarData);
    console.log("Successfully read jar file");

    const output = resourcepackZip;

    const mcmeta = {
        pack: {
            pack_format: 9,
            description: "VanillaPuddingTart - " + rpName
        }
    };

    let promises: Promise<boolean>[] = [];

    let atlas: boolean[] = [];
    let largestX = 0;
    let largestY = 0;
    let placedTextures: { x: number, y: number, textures: PNG[] }[] = [];

    for (let blockData of blockDatas as unknown as BlockData[]) {
        const textureNames = MODEL_TEXTURES[blockData.model];
        const textures = (await Promise.all(textureNames.map(async textureName => {
            const path = `assets/minecraft/textures/block/${blockData.textures[textureName]}.png`;
            let buffer = await resourcepackZip.file(path)?.async("arraybuffer");
            if (!buffer)
                buffer = await jarZip.file(path)?.async("arraybuffer");
            if (!buffer) {
                console.log(`Missing texture: ${textureName}`);
                return null;
            }

            return PNG.load(new Uint8Array(buffer));
        }))).filter(texture => texture !== null) as PNG[];

        const maxSize = Math.max(...textures.map(texture => texture.width));
        const [x, y] = findPlaceInAtlas(atlas, textures, maxSize);
        largestX = Math.max(largestX, x + maxSize * textures.length / MIN_IMAGE_SIZE);
        largestY = Math.max(largestY, y + maxSize / MIN_IMAGE_SIZE);

        placedTextures.push({ x, y, textures });
        promises.push(createDataTexture(x, y, maxSize, output, blockData.name));
    }

    const buffer = await createAtlas(placedTextures, largestX, largestY);
    output.file("assets/minecraft/textures/effect/atlas.png", buffer, { binary: true });

    output.file("pack.mcmeta", JSON.stringify(mcmeta));

    await Promise.all(promises);
    output.generateAsync({ type: "blob" })
        .then(blob => {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute("download", `VPT_${rpName}.zip`);
            a.click();
        });
}