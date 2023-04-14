import { encode, ImageData } from "fast-png";
import { FileRef } from "./file";
import { Atlas, encodeLocation } from './atlas';
import { Vector3 } from '@math.gl/core';

export enum Rotation {
    Deg0 = 0,
    Deg90 = 90,
    Deg180 = 180,
    Deg270 = 270,
}

export type ModelReference = {
    model: string,
    x?: Rotation,
    y?: Rotation,
    uvlock?: boolean,
    weight?: number,
};

export enum Face {
    down = "down",
    up = "up",
    south = "south",
    north = "north",
    east = "east",
    west = "west",
};

export enum RotationAxis {
    x = "x",
    y = "y",
    z = "z",
};

export type FaceData = {
    uv?: [number, number, number, number],
    texture: string,
    cullface?: Face,
    rotation?: number,
    tintindex?: number,
};

export type Element = {
    from: [number, number, number],
    to: [number, number, number],
    rotation?: {
        origin?: [number, number, number],
        axis: RotationAxis,
        angle: number,
        rescale?: boolean,
    },
    shade?: boolean,
    faces: { [key in Face]?: FaceData };
};

export type Model = {
    parent?: string,
    ambientocclusion?: boolean,
    textures: { [key: string]: string; },
    elements?: Element[],
};

function getRotation(element: Element) {
    if (!element.rotation)
        return { axis: new Vector3(1, 0, 0), angle: 2, origin: [8, 8, 8], rescale: false };

    let { origin, axis, angle, rescale } = element.rotation;
    if (!origin)
        origin = [8, 8, 8];
    if (!rescale)
        rescale = false;

    angle = angle / 22.5 + 2;

    switch (axis) {
        case RotationAxis.x:
            return { axis: new Vector3(1, 0, 0), angle, origin, rescale };
        case RotationAxis.y:
            return { axis: new Vector3(0, 1, 0), angle, origin, rescale };
        case RotationAxis.z:
            return { axis: new Vector3(0, 0, 1), angle, origin, rescale };
    }
}

function generateUV(element: Element, face: Face): [number, number, number, number] {
    switch (face) {
        case Face.down:
            return [element.from[0], 16 - element.to[2], element.to[0], 16 - element.from[2]];
        case Face.up:
            return [element.from[0], element.from[2], element.to[0], element.to[2]];
        case Face.north:
            return [16 - element.to[0], 16 - element.to[1], 16 - element.from[0], 16 - element.from[1]];
        case Face.south:
            return [element.from[0], 16 - element.to[1], element.to[0], 16 - element.from[1]];
        case Face.west:
            return [element.from[2], 16 - element.to[1], element.to[2], 16 - element.from[1]];
        case Face.east:
            return [16 - element.to[2], 16 - element.to[1], 16 - element.from[2], 16 - element.from[1]];
    }
}

export function encodeModel(model: Model, atlas: Atlas): number[] {
    if (!model.elements)
        return [0, 0, 0, 0];

    const elementCount = model.elements.length;

    return [elementCount & 0xFF, 0, 0, 0xFF, ...model.elements.map(element => {
        const res = [];
        const rotation = getRotation(element);
        let from = element.from;
        let to = element.to;

        if (rotation.rescale && element.rotation) {
            const cosAngle = Math.cos(element.rotation.angle / 180 * Math.PI);

            const fromVec = new Vector3(...from);
            const toVec = new Vector3(...to);

            const center = new Vector3().copy(fromVec).add(toVec).scale(0.5);
            const fromRel = new Vector3().copy(fromVec).subtract(center);
            const toRel = new Vector3().copy(toVec).subtract(center);

            switch (element.rotation.axis) {
                case RotationAxis.y:
                    fromRel.x /= cosAngle;
                    fromRel.z /= cosAngle;
                    toRel.x /= cosAngle;
                    toRel.z /= cosAngle;
                    break;
            }

            from = [...fromRel.add(center).toArray()] as [number, number, number];
            to = [...toRel.add(center).toArray()] as [number, number, number];
        }

        res.push(...from.map(x => Math.round((x + 16) / 48 * 255)), 255);
        res.push(...to.map(x => Math.round((x + 16) / 48 * 255)), 255);
        res.push(...rotation.axis.toArray().map(x => x * 255.0), rotation.angle);
        res.push(...rotation.origin.map(x => Math.round(x / 16.0 * 255)), 255);

        Object.keys(Face).forEach(face => {
            if (!element.faces[face as Face]) {
                res.push(0, 0, 0, 0xFF, 0, 0, 0, 0);
                return;
            }
            const faceData = element.faces[face as Face]!;
            
            if (!faceData.texture)
                return; // Missing texture

            const textureName = faceData.texture.replace(/^#/, "");
            if (!model.textures[textureName])
                return; // Missing texture

            const textureLocation = atlas.locations.get(model.textures[textureName].replace(/(minecraft:)?(block\/)?/, ""))!;
            res.push(...encodeLocation(textureLocation));
            res.push(...(element.faces[face as Face]?.uv!).map(x => Math.round(x / 16.0 * 255)));
        });

        return res;
    }).flat()];
}

export type ModelStorage = Map<string, FileRef<Model>>;

const rotateX = {
    0: (element: Element) => element,
    90: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [x1, z1, 16 - y2];
        element.to = [x2, z2, 16 - y1];

        return element;
    },
    180: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [x1, 16 - y2, 16 - z2];
        element.to = [x2, 16 - y1, 16 - z1];

        return element;
    },
    270: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [x1, 16 - z2, y1];
        element.to = [x2, 16 - z1, y2];

        return element;
    },
};

const rotateY = {
    0: (element: Element) => element,
    90: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [16 - z2, y1, x1];
        element.to = [16 - z1, y2, x2];

        return element;
    },
    180: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [16 - x2, y1, 16 - z2];
        element.to = [16 - x1, y2, 16 - z1];

        return element;
    },
    270: (element: Element) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        element.from = [z1, y1, 16 - x2];
        element.to = [z2, y2, 16 - x1];

        return element;
    },
};

const xRotationFaceMapping = {
    0: {
        down: "down",
        up: "up",
        south: "south",
        north: "north",
        east: "east",
        west: "west",
    },
    90: {
        east: "east",
        west: "west",
        down: "south",
        up: "north",
        north: "down",
        south: "up",
    },
    180: {
        east: "east",
        west: "west",
        down: "up",
        up: "down",
        north: "south",
        south: "north",
    },
    270: {
        down: "north",
        up: "south",
        west: "west",
        east: "east",
        north: "up",
        south: "down",
    },
};

const yRotationFaceMapping = {
    0: {
        down: "down",
        up: "up",
        south: "south",
        north: "north",
        east: "east",
        west: "west",
    },
    90: {
        down: "down",
        up: "up",
        north: "east",
        east: "south",
        south: "west",
        west: "north",
    },
    180: {
        down: "down",
        up: "up",
        north: "south",
        south: "north",
        east: "west",
        west: "east",
    },
    270: {
        down: "down",
        up: "up",
        north: "west",
        west: "south",
        south: "east",
        east: "north",
    },
};

const xRotationMapping = {
    0: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.z,
    },
    90: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.z,
        [RotationAxis.z]: RotationAxis.y,
    },
    180: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.z,
    },
    270: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.z,
        [RotationAxis.z]: RotationAxis.y,
    },
};

const yRotationMapping = {
    0: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.z,
    },
    90: {
        [RotationAxis.x]: RotationAxis.z,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.x,
    },
    180: {
        [RotationAxis.x]: RotationAxis.x,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.z,
    },
    270: {
        [RotationAxis.x]: RotationAxis.z,
        [RotationAxis.y]: RotationAxis.y,
        [RotationAxis.z]: RotationAxis.x,
    },
};

const xRotateOrigin = {
    0: (origin: [number, number, number]) => origin,
    90: (origin: [number, number, number]) => [origin[0], origin[2], 16 - origin[1]],
    180: (origin: [number, number, number]) => [origin[0], 16 - origin[1], 16 - origin[2]],
    270: (origin: [number, number, number]) => [origin[0], 16 - origin[2], origin[1]],
};

const yRotateOrigin = {
    0: (origin: [number, number, number]) => origin,
    90: (origin: [number, number, number]) => [16 - origin[2], origin[1], origin[0]],
    180: (origin: [number, number, number]) => [16 - origin[0], origin[1], 16 - origin[2]],
    270: (origin: [number, number, number]) => [origin[2], origin[1], 16 - origin[0]],
};

export function stripModelName(name: string) {
    return name.replace(/(minecraft:)?(block\/)?/, "");
}

export function getAbsoluteModel(model: Model, models: Map<string, FileRef<Model>>) {
    const result = model;
    while (!result.elements) {
        if (!result.parent)
            throw new Error(`No elements or parent for model`);

        const parentName = stripModelName(result.parent);

        if (!models.has(parentName))
            throw new Error(`No model with name: ${parentName}`);

        const parent = models.get(parentName)!.data;
        result.textures = { ...parent.textures, ...result.textures };
        result.elements = parent.elements;
        result.parent = parent.parent;
    }

    return result;
}

export function applyReferenceRotation(reference: ModelReference, models: Map<string, FileRef<Model>>) {
    const baseModel = models.get(stripModelName(reference.model))!.data;
    let absoluteModel: Model;
    try {
        absoluteModel = getAbsoluteModel(baseModel, models);
    } catch (ex) {
        return baseModel;
    }

    absoluteModel = JSON.parse(JSON.stringify(absoluteModel)) as Model;
    if (!absoluteModel.elements)
        return absoluteModel;

    const xRotator = rotateX[reference.x ?? 0];
    const yRotator = rotateY[reference.y ?? 0];
    const xFaceMapping = xRotationFaceMapping[reference.x ?? 0]!;
    const yFaceMapping = yRotationFaceMapping[reference.y ?? 0]!;
    const xRotationAxis = xRotationMapping[reference.x ?? 0] as { [key in RotationAxis]: RotationAxis };
    const yRotationAxis = yRotationMapping[reference.y ?? 0] as { [key in RotationAxis]: RotationAxis };
    const xOriginRotator = xRotateOrigin[reference.x ?? 0] as (origin: [number, number, number]) => [number, number, number];
    const yOriginRotator = yRotateOrigin[reference.y ?? 0] as (origin: [number, number, number]) => [number, number, number];

    absoluteModel.elements = absoluteModel.elements.map(element => {
        const rotated = yRotator(xRotator(element));

        const newFaces: { [key in Face]?: FaceData } = {};
        for (let key in rotated.faces) {
            const face = rotated.faces[key as Face]!;
            if (!face.uv) {
                face.uv = generateUV(element, key as Face);
            }
            const firstRotationFace = xFaceMapping[key as Face] as Face;
            const secondRotationFace = yFaceMapping[firstRotationFace] as Face;
            newFaces[secondRotationFace] = face;

            if (face.cullface) {
                face.cullface = secondRotationFace
            }

            if (firstRotationFace === Face.east || firstRotationFace === Face.west) {
                face.rotation = ((face.rotation ?? 0) + (reference.x ?? 0)) % 360;
            }
            if (secondRotationFace === Face.up || secondRotationFace === Face.down) {
                face.rotation = ((face.rotation ?? 0) + (reference.y ?? 0)) % 360;
            }
        }
        rotated.faces = newFaces as { [key in Face]: FaceData };

        if (rotated.rotation) {
            rotated.rotation.axis = yRotationAxis[xRotationAxis[rotated.rotation.axis]];
            if (rotated.rotation.origin) {
                rotated.rotation.origin = yOriginRotator(xOriginRotator(rotated.rotation.origin));
            }

            if (reference.x === 90 || reference.x === 180) {
                rotated.rotation.angle *= -1;
            }

            if (rotated.rotation.axis === RotationAxis.z && (reference.y === 180 || reference.y === 270)) {
                rotated.rotation.angle *= -1;
            } if (rotated.rotation.axis === RotationAxis.x && (reference.y === 90 || reference.y === 180)) {
                rotated.rotation.angle *= -1;
            }
        }

        return rotated;
    });

    return absoluteModel;
}

function renameTextures(model: Model, suffix: string) {
    const result = JSON.parse(JSON.stringify(model)) as Model;

    for (let key in result.textures) {
        if (result.textures[key].startsWith("#") && !result.textures[key].endsWith("__")) {
            result.textures[key] += suffix;
        }

        if (key === "particle")
            continue;

        result.textures[key + suffix] = result.textures[key];
        delete result.textures[key];
    }

    if (!result.elements)
        return result;

    result.elements = result.elements.map(element => {
        for (let key in element.faces) {
            const texture = element.faces[key as Face]!.texture;
            if (texture.startsWith("#") && !texture.endsWith("__")) {
                element.faces[key as Face]!.texture += suffix;
            }
        }

        return element;
    });

    return result;
}

export function mergeModels(models: Model[]) {
    let renamedModels = models.map((model, i) => renameTextures(model, `_part${i}__`));
    const result = renamedModels[0];
    for (let i = 1; i < renamedModels.length; i++) {
        result.textures = { ...renamedModels[i].textures, ...result.textures };
        result.elements = [...(result.elements ?? []), ...(renamedModels[i].elements ?? [])];
    }

    return result;
}

export function simplifyModel(model: Model) {
    delete model.parent;

    const newTextures: { [key: string]: string; } = {};
    const mapping = new Map<string, string>();
    for (let key in model.textures) {
        let texturePath = model.textures[key];
        if (!texturePath)
            continue;

        while (texturePath.startsWith("#")) {
            texturePath = model.textures[texturePath.replace("#", "")];
        }
        if (key === "particle") {
            newTextures[key] = texturePath;
        } else {
            const newKey = texturePath.replace(/(minecraft:)?(block\/)?/, "");
            newTextures[newKey] = texturePath;
            mapping.set(key, newKey);
        }
    }
    model.textures = newTextures;

    model.elements?.forEach(element => {
        for (let key in element.faces) {
            const face = element.faces[key as Face]!;
            face.texture = "#" + mapping.get(face.texture.replace("#", ""))!;
        }
    });
}

export function disableShading(model: Model) {
    model.ambientocclusion = false;
    if (!model.elements)
        return;
    model.elements.forEach(element => {
        element.shade = false;
    });
}

export function createDataTexture(index: number) {
    const data = new Uint8Array(16 * 16 * 4);
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            if (x < 8) {
                data[(x + y * 16) * 4 + 0] = 0xFF;
                data[(x + y * 16) * 4 + 1] = 0;
                data[(x + y * 16) * 4 + 2] = 0xFF;
                data[(x + y * 16) * 4 + 3] = 0xFF;
            } else {
                data[(x + y * 16) * 4 + 0] = index & 0xFF;
                data[(x + y * 16) * 4 + 1] = (index >> 8) & 0xFF;
                data[(x + y * 16) * 4 + 2] = (index >> 16) & 0xFF;
                data[(x + y * 16) * 4 + 3] = 0xFF;
            }
        }
    }

    const png: ImageData = {
        width: 16,
        height: 16,
        data: data,
        channels: 4,
        depth: 8,
    };

    return encode(png);
}