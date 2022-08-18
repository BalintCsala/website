import JSZip from "jszip";
import PNG from "png-ts";
import blockDatas from "./block_data.json";

const MIN_IMAGE_SIZE = 16;
const POS_BITS = 11;

const ATLAS_GRID_SIZE = 2 ** POS_BITS;

interface BlockData {
    name: string;
    model: "cube" | "same_sides";
    textures: { [key: string]: string; };
}

const MODEL_TEXTURES = {
    cube: ["texture"],
    same_sides: ["top", "bottom", "side"]
};

async function waitForReaderString(reader: FileReader): Promise<string> {
    return new Promise(resolve => {
        reader.onload = () => resolve(reader.result as string);
    });
}

async function waitForReader(reader: FileReader): Promise<ArrayBuffer> {
    return new Promise(resolve => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
    });
}

async function waitForImageLoad(img: HTMLImageElement): Promise<null> {
    return new Promise(resolve => {
        img.onload = () => resolve(null);
    });
}

function get(atlas: boolean[], x: number, y: number) {
    return atlas[x + y * ATLAS_GRID_SIZE] ?? false;
}

function set(atlas: boolean[], x: number, y: number) {
    atlas[x + y * ATLAS_GRID_SIZE] = true;
}

function findPlaceInAtlas(atlas: boolean[], textureCount: number, size: number): [number, number] {
    const cellWidth = (textureCount * size) / MIN_IMAGE_SIZE;
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
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!!;
    ctx.fillStyle = `rgb(${[255, 0, 255]})`;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = `rgb(${[index & 0xFF, (index >> 8) & 0xFF, index >> 16]})`;
    ctx.fillRect(1, 0, 1, 1);
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            zip.file(`assets/minecraft/textures/block/${block}_data.png`, blob?.arrayBuffer()!!, { binary: true });
            resolve(true);
        });
    });
};

async function loadPNG(resourcepackZip: JSZip, jarZip: JSZip, textureName: string) {
    const path = `assets/minecraft/textures/block/${textureName}.png`;
    let buffer = await resourcepackZip.file(path)?.async("arraybuffer");
    if (!buffer)
        buffer = await jarZip.file(path)?.async("arraybuffer");
    if (!buffer) {
        console.log(`Missing texture: ${textureName}`);
        return null;
    }

    return PNG.load(new Uint8Array(buffer));
}

class Texture {
    public albedo: PNG;
    public normal: PNG | null;
    public specular: PNG | null;

    constructor(albedo: PNG, normal: PNG | null, specular: PNG | null) {
        this.albedo = albedo;
        this.normal = normal;
        this.specular = specular;
    }
}

class Atlas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private imgData: ImageData;
    private size: number;

    constructor(size: number) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = size;
        this.canvas.height = size;
        this.ctx = this.canvas.getContext("2d")!!;
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, size, size);
        this.imgData = this.ctx.getImageData(0, 0, size, size);
        this.size = size;
    }

    putTexture(x: number, y: number, texture: PNG, useAlphaAsBlue: boolean = false) {
        let multiplier = texture.pixelBitlength === 24 ? 3 : 4;

        const data = texture.decodePixels();
        for (let dx = 0; dx < texture.width; dx++) {
            for (let dy = 0; dy < texture.height; dy++) {
                const ctxIndex = ((x + dx) + (y + dy) * this.size) * 4;
                const index = (dx + dy * texture.width) * multiplier;
                this.imgData.data[ctxIndex + 0] = data[index + 0];
                this.imgData.data[ctxIndex + 1] = data[index + 1];
                if (useAlphaAsBlue) {
                    if (multiplier === 4)
                        this.imgData.data[ctxIndex + 2] = data[index + 3];
                } else {
                    this.imgData.data[ctxIndex + 2] = data[index + 2];
                }
                this.imgData.data[ctxIndex + 3] = 255;
            }
        }
    }

    async toArrayBuffer(): Promise<ArrayBuffer> {
        this.ctx.putImageData(this.imgData, 0, 0);
        return new Promise(resolve => {
            this.canvas.toBlob(blob => blob?.arrayBuffer()
                .then(buffer => resolve(buffer)));
        });
    }
}

async function createAtlases(placedTextures: { x: number; y: number; textures: Texture[]; }[], largestX: number, largestY: number) {
    const size = 2 ** (Math.ceil(Math.log2(Math.max(largestX, largestY)))) * MIN_IMAGE_SIZE;

    const albedoAtlas = new Atlas(size);
    const normalAtlas = new Atlas(size);
    const specularAtlas = new Atlas(size);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!!;
    const imageData = ctx.getImageData(0, 0, size, size);

    for (let { x, y, textures } of placedTextures) {
        let posX = x * MIN_IMAGE_SIZE;
        let posY = y * MIN_IMAGE_SIZE;
        for (let texture of textures) {
            albedoAtlas.putTexture(posX, posY, texture.albedo);
            if (texture.normal)
                normalAtlas.putTexture(posX, posY, texture.normal);
            if (texture.specular)
                specularAtlas.putTexture(posX, posY, texture.specular, true);

            posX += texture.albedo.width;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return Promise.all([
        albedoAtlas.toArrayBuffer(),
        normalAtlas.toArrayBuffer(),
        specularAtlas.toArrayBuffer(),
    ]);

}

enum Display {
    ThirdpersonRighthand = "thirdperson_righthand",
    ThirdpersonLefthand = "thirdperson_lefthand",
    FirstpersonRighthand = "firstperson_righthand",
    FirstpersonLefthand = "firstperson_lefthand",
    Gui = "gui",
    Head = "head",
    Ground = "ground",
    Fixed = "fixed",
}

enum Face {
    Down = "down",
    Up = "up",
    North = "north",
    South = "south",
    West = "west",
    East = "east"
}

interface Model {
    parent?: string;
    ambientocclusion?: boolean;
    display?: {
        [key in Display]: {
            rotation: [number, number, number];
            translation: [number, number, number];
            scale: [number, number, number];
        };
    };
    textures?: {
        [key: string]: string;
    };
    elements?: {
        from: [number, number, number];
        to: [number, number, number];
        rotation?: {
            origin: [number, number, number];
            axis: "x" | "y" | "z";
            angle: number;
            rescale?: boolean;
        };
        shade?: boolean;
        faces: {
            [key in Face]?: {
                uv?: [number, number, number, number];
                texture: `#${string}`;
                cullface?: Face;
                rotation?: number;
                tintindex?: number;
            }
        };
    }[];
}

async function mergeBlockModel(block: string, jar: JSZip): Promise<Model> {
    let model: Model = {};
    let current: string | undefined = block;
    while (model.elements === undefined) {
        const file = jar.file(`assets/minecraft/models/block/${current}.json`);

        if (!file) {
            console.error(`Failed to open model file ${current}.json`);
            return model;
        }
        const content = JSON.parse(await file.async("text")) as Model;
        current = content.parent?.replace(/(minecraft:)?block\//, "");
        model = {
            ...content,
            ...model,
            textures: { ...model.textures, ...content.textures },
            elements: content.elements,
        };

        if (!current)
            break;

        model.parent = `block/${current}`;
    }

    return model;
}

function addShadeAndAmbientOcclusion(model: Model) {
    model.ambientocclusion = false;
    if (model.elements) {
        for (let i = 0; i < model.elements.length; i++) {
            model.elements[i].shade = false;
        }
    }
}

async function createSkinTexture(img: HTMLImageElement): Promise<ArrayBuffer> {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!!;

    // Head
    ctx.drawImage(img, 8, 8, 8, 8, 4, 0, 8, 8);
    ctx.drawImage(img, 40, 8, 8, 8, 4, 0, 8, 8);
    // Body
    ctx.drawImage(img, 20, 20, 8, 12, 4, 8, 8, 12);
    ctx.drawImage(img, 20, 36, 8, 12, 4, 8, 8, 12);
    // Left arm
    ctx.drawImage(img, 36, 52, 4, 12, 0, 8, 4, 12);
    ctx.drawImage(img, 52, 52, 4, 12, 0, 8, 4, 12);
    // Right arm
    ctx.drawImage(img, 44, 20, 4, 12, 12, 8, 4, 12);
    ctx.drawImage(img, 44, 36, 4, 12, 12, 8, 4, 12);
    // Left leg
    ctx.drawImage(img, 20, 52, 4, 12, 4, 20, 4, 12);
    ctx.drawImage(img, 4, 36, 4, 12, 4, 20, 4, 12);
    // Right leg
    ctx.drawImage(img, 4, 20, 4, 16, 4, 20, 8, 12);
    ctx.drawImage(img, 4, 36, 4, 16, 4, 20, 8, 12);

    return new Promise(resolve => {
        canvas.toBlob(blob => blob?.arrayBuffer()
            .then(buffer => resolve(buffer)));
    });
}

export async function generateResourcepack(jar: File, file: File, skin: File | null) {
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
    let placedTextures: { x: number, y: number, textures: Texture[]; }[] = [];

    console.log("Collecting textures...");

    for (let blockData of blockDatas as unknown as BlockData[]) {
        const textureNames = MODEL_TEXTURES[blockData.model];
        const textures = (await Promise.all(textureNames.map(async textureName => {
            const albedo = await loadPNG(resourcepackZip, jarZip, blockData.textures[textureName]);
            if (!albedo)
                return null;
            const normal = await loadPNG(resourcepackZip, jarZip, blockData.textures[textureName] + "_n");
            const specular = await loadPNG(resourcepackZip, jarZip, blockData.textures[textureName] + "_s");
            return new Texture(albedo, normal, specular);
        }))).filter(texture => texture !== null) as Texture[];

        const maxSize = Math.max(...textures.map(texture => texture.albedo.width));
        const [x, y] = findPlaceInAtlas(atlas, textures.length, maxSize);
        largestX = Math.max(largestX, x + maxSize * textures.length / MIN_IMAGE_SIZE);
        largestY = Math.max(largestY, y + maxSize / MIN_IMAGE_SIZE);

        placedTextures.push({ x, y, textures });
        promises.push(createDataTexture(x, y, maxSize, output, blockData.name));
        let model = await mergeBlockModel(blockData.name, jarZip);
        if (!model.elements || !model.textures) {
            console.error(`Failed to merge model file for ${blockData.name}`);
            continue;
        }
        model.textures["marker"] = `minecraft:block/${blockData.name}_data`;
        model.elements.push({
            from: [1, 1, 1],
            to: [15, 15, 15],
            faces: {
                up: { texture: "#marker", uv: [0, 0, 8, 16], tintindex: 0 },
                down: { texture: "#marker", uv: [0, 0, 8, 16], tintindex: 0 }
            }
        });
        output.file(`assets/minecraft/models/block/${blockData.name}.json`, JSON.stringify(model));
    }

    console.log("Writing atlases...");

    const [albedoBuffer, normalBuffer, specularBuffer] = await createAtlases(placedTextures, largestX, largestY);
    output.file("assets/minecraft/textures/effect/atlas.png", albedoBuffer, { binary: true });
    output.file("assets/minecraft/textures/effect/atlas_normal.png", normalBuffer, { binary: true });
    output.file("assets/minecraft/textures/effect/atlas_specular.png", specularBuffer, { binary: true });

    console.log("Removing ambient occlusion and shading");

    const modelFolder = output.folder("assets/minecraft/models/block")!!;
    const files = modelFolder.files;
    const processed = new Set<string>();
    let missingParents = new Set<string>();
    for (let file of Object.values(files)) {
        if (file.dir || !file.name.endsWith(".json"))
            continue;

        const parts = file.name.split("/");
        const blockName = parts[parts.length - 1].replace(".json", "");
        processed.add(blockName);

        missingParents.delete(blockName);

        let content = JSON.parse(await file.async("string")) as Model;
        if (content.parent) {
            const parentBlock = content.parent.replace(/(minecraft:)?block\//, "");
            if (!processed.has(parentBlock))
                missingParents.add(parentBlock);
        }

        addShadeAndAmbientOcclusion(content);
        output.file(file.name, JSON.stringify(content));
    }

    console.log("Adding missing parents...");

    while (missingParents.size > 0) {
        const next = missingParents.values().next().value;
        missingParents.delete(next);
        
        const noNamespace = next.replace("minecraft:", "");
        if (noNamespace.startsWith("item") || noNamespace.startsWith("builtin"))
            continue;
        processed.add(next);
        console.log(next);
        

        const path = `assets/minecraft/models/block/${noNamespace}.json`;
        console.log(path);
        
        const file = jarZip.file(path);
        if (file === null)
            continue;
        let content = JSON.parse(await file.async("string"));
        if (content.parent) {
            const parentBlock = content.parent.replace(/(minecraft:)?block\//, "");
            if (!processed.has(parentBlock))
                missingParents.add(parentBlock);
        }

        addShadeAndAmbientOcclusion(content);
        output.file(path, JSON.stringify(content));
    }

    console.log("Adding mcmeta file...");

    output.file("pack.mcmeta", JSON.stringify(mcmeta));
    await Promise.all(promises);

    if (skin !== null) {
        console.log("Creating skin");
        const img = new Image();
        let reader = new FileReader();
        reader.readAsDataURL(skin);
        img.src = await waitForReaderString(reader);
        await waitForImageLoad(img);

        const skinBuffer = await createSkinTexture(img);

        output.file("assets/minecraft/textures/effect/steve.png", skinBuffer, { binary: true });

    }

    console.log("Done");


    output.generateAsync({ type: "blob" })
        .then(blob => {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute("download", `VPT_${rpName}.zip`);
            a.click();
        });
}