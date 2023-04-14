import { DecodedPng, decode, encode } from "fast-png";
import JSZip from 'jszip';

const MIN_TEXTURE_SIZE = 16;
const MAX_ATLAS_SIZE = 32768;
const GRID_WIDTH = MAX_ATLAS_SIZE / MIN_TEXTURE_SIZE;

type Image = { width: number, height: number, data: Uint8Array; };

type Texture = {
    albedo: Image,
    normal: Image,
    specular: Image,
    size: number,
};

type TextureLocation = {
    x: number,
    y: number,
    size: number,
};

export function encodeLocation(location: TextureLocation) {
    let data = (Math.round(Math.log2(location.size)) << 20) | (location.y << 10) | location.x;

    return [
        data & 0xFF,
        (data >> 8) & 0xFF,
        (data >> 16) & 0xFF,
        (data >> 24) & 0xFF,
    ];
}
export class Atlas {

    private textures = new Map<string, Texture>();
    private width = 0;
    private height = 0;

    public locations = new Map<string, TextureLocation>();

    private static ensure4Channels(image: DecodedPng) {
        if (image.channels === 4)
            return image as Image;

        return {
            width: image.width,
            height: image.height,
            data: new Uint8Array(
                new Array(image.width * image.height * 4).fill(0).map((_, i) => i % 4 === 3 ? 255 : image.data[Math.floor(i / 4) * 3 + i % 4])
            )
        };
    }

    public async addTexture(name: string, zip: JSZip) {
        if (this.textures.has(name))
            return;

        const albedo = Atlas.ensure4Channels(decode(await zip.file(`${name}.png`)?.async("uint8array")!));

        let normalData;
        try {
            normalData = Atlas.ensure4Channels(decode(await zip.file(`${name}_n.png`)?.async("uint8array")!));
        } catch (e) {
            normalData = {
                width: albedo.width,
                height: albedo.height,
                data: new Uint8Array(
                    new Array(albedo.width * albedo.height * 4).fill(0).map((_, i) => [127, 127, 255, 255][i % 4])
                )
            };
        }

        let specularData;
        try {
            specularData = Atlas.ensure4Channels(decode(await zip.file(`${name}_s.png`)?.async("uint8array")!));
        } catch (e) {
            specularData = {
                width: albedo.width,
                height: albedo.height,
                data: new Uint8Array(
                    new Array(albedo.width * albedo.height * 4).fill(0).map((_, i) => [0, 10, 0, 255][i % 4])
                )
            };
        }
        const texture: Texture = {
            albedo: albedo as Image,
            normal: normalData as Image,
            specular: specularData as Image,
            size: albedo.width,
        };


        this.textures.set(name, texture);
    }

    private findPlace(places: boolean[], size: number) {
        const requiredPlaces = size / MIN_TEXTURE_SIZE;
        for (let i = 0; i < GRID_WIDTH; i++) {
            for (let j = 0; j < 2 * i + 1; j++) {
                const x = Math.min(i, j);
                const y = i - Math.max(0, j - i);

                let foundX = false;
                for (let dx = 0; dx < requiredPlaces; dx++) {
                    let foundY = false;
                    for (let dy = 0; dy < requiredPlaces; dy++) {
                        if (places[x + dx + (y + dy) * GRID_WIDTH]) {
                            foundY = true;
                            break;
                        }
                    }

                    if (foundY) {
                        foundX = true;
                        break;
                    }
                }

                if (foundX)
                    continue;

                for (let dx = 0; dx < requiredPlaces; dx++) {
                    for (let dy = 0; dy < requiredPlaces; dy++) {
                        places[x + dx + (y + dy) * GRID_WIDTH] = true;
                    }
                }

                return { x, y, size: requiredPlaces };
            }
        }

        throw new Error("Atlas is full!");
    }

    public generateLocations() {
        const places: boolean[] = [];

        Array.from(this.textures.entries())
            .sort(([, tex1], [, tex2]) => tex2.size - tex1.size)
            .forEach(([name, texture]) => {
                const location = this.findPlace(places, texture.size);
                this.locations.set(name, location);
                this.width = Math.max(this.width, (location.x + location.size) * MIN_TEXTURE_SIZE);
                this.height = Math.max(this.height, (location.y + location.size) * MIN_TEXTURE_SIZE);
            });
    }

    public generateAtlas() {
        const atlas = new Uint8Array(this.width * 2 * this.height * 2 * 4);

        for (const [name, location] of this.locations.entries()) {
            const locX = location.x * MIN_TEXTURE_SIZE;
            const locY = location.y * MIN_TEXTURE_SIZE;
            const texture = this.textures.get(name)!;
            for (let x = 0; x < location.size * MIN_TEXTURE_SIZE; x++) {
                for (let y = 0; y < location.size * MIN_TEXTURE_SIZE; y++) {
                    for (let i = 0; i < 4; i++) {
                        const albedoIndex = (x + locX + (y + locY) * this.width * 2) * 4 + i;
                        const normalIndex = (x + locX + this.width + (y + locY) * this.width * 2) * 4 + i;
                        const specularIndex = (x + locX + (y + locY + this.height) * this.width * 2) * 4 + i;

                        const textureIndex = (x + y * texture.size) * 4 + i;
                        atlas[albedoIndex] = texture.albedo.data[textureIndex];
                        atlas[normalIndex] = texture.normal.data[textureIndex];
                        atlas[specularIndex] = texture.specular.data[textureIndex];
                    }
                }
            }
        }

        return encode({
            width: this.width * 2,
            height: this.height * 2,
            data: atlas,
            channels: 4,
            depth: 8,
        });
    }

}