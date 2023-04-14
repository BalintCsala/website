import JSZip from "jszip";
import { waitForReader } from "../promises";
import { Atlas } from "./atlas";
import { FileRef, readFile } from "./file";
import { Face, Model, createDataTexture, disableShading, encodeModel, simplifyModel } from "./model";
import { Multipart, convertMultipartToVariant } from './multipart';
import { Variants, applyReferences } from './variants';
import { ImageData, encode } from "fast-png";

const models = new Map<string, FileRef<Model>>();
const generatedModels = new Map<string, FileRef<Model>>();
const variants = new Map<string, FileRef<Variants>>();

async function collectModels(zip: JSZip) {
    const promises: Promise<any>[] = [];
    zip.folder("assets/minecraft/models/block")?.forEach((path, file) => {
        const name = path.replace(".json", "");
        promises.push(readFile<Model>(file, name)
            .then(model => models.set(name, model)));
    });
    await Promise.all(promises);
}

async function collectVariants(zip: JSZip) {
    const files: FileRef<Multipart | Variants>[] = [];
    const promises: Promise<any>[] = [];
    zip.folder("assets/minecraft/blockstates")
        ?.forEach((path, file) => {
            promises.push(readFile<Multipart | Variants>(file, path.replace(".json", ""))
                .then(file => files.push(file)));
        });

    await Promise.all(promises);

    files.forEach(file => {
        if ("multipart" in file.data) {
            variants.set(file.name, convertMultipartToVariant(file as FileRef<Multipart>, models));
            return;
        }

        variants.set(file.name, file as FileRef<Variants>);
    });
}

export async function newGenerateResourcepack(jar: File, zip: File, skin: File | null, setMessage: (msg: string) => void, setProgress: (progress: number) => void) {
    let counter = 0;
    const rpName = zip.name.replace(".zip", "");

    setMessage("Reading resourcepack...");
    const reader = new FileReader();
    reader.readAsArrayBuffer(zip);
    const rawResourcepackData = await waitForReader<ArrayBuffer>(reader);
    const resourcepackZip = await JSZip.loadAsync(rawResourcepackData);

    setMessage("Reading version jar...");
    reader.readAsArrayBuffer(jar);
    const rawJarData = await waitForReader<ArrayBuffer>(reader);
    const jarZip = await JSZip.loadAsync(rawJarData);

    const output = resourcepackZip;

    setMessage("Replacing pack.mcmeta...");
    const originalMcmeta = JSON.parse(await resourcepackZip.file("pack.mcmeta")!.async("text"));
    const mcmeta = {
        pack: {
            pack_format: originalMcmeta.pack.pack_format,
            description: "VanillaPuddingTart - " + rpName
        }
    };
    output.file("pack.mcmeta", JSON.stringify(mcmeta));

    models.clear();
    generatedModels.clear();

    setMessage("Reading models...");

    await collectModels(jarZip);
    await collectModels(resourcepackZip);

    setMessage("Reading blockstates...");

    await collectVariants(jarZip);
    await collectVariants(resourcepackZip);

    setMessage("Applying references...");

    counter = 0;
    variants.forEach(variantFile => {
        setProgress(++counter / variants.size)
        return applyReferences(variantFile, models, generatedModels);
    });

    setMessage("Applying changes to models...");

    const newModels = [...generatedModels.values()];
    newModels.forEach(model => simplifyModel(model.data));
    newModels.forEach(model => disableShading(model.data));

    setMessage("Saving blockstates...");

    counter = 0;
    variants.forEach(variantFile => {
        setProgress(++counter / variants.size);
        output.file(`assets/minecraft/blockstates/${variantFile.name}.json`, JSON.stringify(variantFile.data));
    });

    const atlas = new Atlas();
    const textures = new Map<string, { name: string, folder: JSZip; }>();
    const jarBlocks = jarZip.folder("assets/minecraft/textures/block");
    const rpBlocks = resourcepackZip.folder("assets/minecraft/textures/block");

    setMessage("Collecting textures...");

    jarBlocks?.forEach(path => {
        textures.set(path, { name: path, folder: jarBlocks });
    });
    rpBlocks?.forEach(path => {
        textures.set(path, { name: path, folder: rpBlocks });
    });

    setMessage("Generating the atlas...");

    await Promise.all([...textures.values()]
        .filter(({name, }) => name.endsWith("png") && !name.endsWith("_n.png") && !name.endsWith("_s.png"))
        .map(async ({name, folder}, i, arr) => {
            setProgress(i / arr.length);
            const textureName = name.replace(".png", "");
            await atlas.addTexture(textureName, folder);
        }));

    atlas.generateLocations();
    const atlasData = atlas.generateAtlas();

    setMessage("Saving the atlas...");

    output.file("assets/minecraft/textures/effect/atlas_combined.png", atlasData);

    setMessage("Generating block models...");

    const rows = newModels.map((model, i) => {
        setProgress(i / newModels.length);
        return encodeModel(model.data, atlas);
    });
    const maxRowLength = Math.max(...rows.map(row => row.length));

    setMessage("Saving block models...");
    
    const data = rows.map(row => [...row, ...new Array(maxRowLength - row.length).fill(0)]).flat();
    const png: ImageData = {
        width: maxRowLength / 4,
        height: rows.length,
        data: new Uint8Array(data),
        channels: 4,
        depth: 8,
    };
    output.file("assets/minecraft/textures/effect/model_data.png", encode(png));
    // TODO: Steve

    setMessage("Creating markers...");

    newModels.forEach((model, i) => {
        setProgress(i / newModels.length);
        model.data.textures["marker"] = `minecraft:block/${model.name}_data__`;
        model.data.elements?.push(
            {
                from: [7, 7, 7],
                to: [9, 9, 9],
                faces: {
                    [Face.up]: {
                        texture: "#marker",
                        uv: [2, 2, 4, 4],
                        tintindex: 0,
                    },
                    [Face.down]: {
                        texture: "#marker",
                        uv: [2, 2, 4, 4],
                        tintindex: 0,
                    }
                },
                shade: false
            });
        output.file(`assets/minecraft/textures/block/${model.name}_data__.png`, createDataTexture(i));
    });

    setMessage("Saving models...");

    newModels.forEach((model, i) => {
        setProgress(i / newModels.length);
        output.file(`assets/minecraft/models/block/${model.name}.json`, JSON.stringify(model.data));
    });

    setMessage("Done!")

    output.generateAsync({ type: "blob" })
        .then(blob => {
            const a = document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.setAttribute("download", `VPT_${rpName}.zip`);
            a.click();
        });
}