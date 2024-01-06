import type { FileRef } from "./file.ts";
import { applyReferenceRotation } from "./model.ts";
import type { Model, ModelReference, ModelStorage } from "./model.ts";

export type Variant = ModelReference | ModelReference[];

export type Variants = {
    variants: { [key: string]: Variant };
};

export function applyReferences(
    blockstate: FileRef<Variants>,
    models: ModelStorage,
    generatedModels: ModelStorage
) {
    const variants = blockstate.data.variants;
    let generatedModelCount = 0;

    const newVariants: Variants = { variants: {} };
    for (let key in variants) {
        const variant = variants[key];

        let model: Model;
        if (variant instanceof Array) {
            model = applyReferenceRotation(
                variant[0] as ModelReference,
                models
            );
        } else {
            model = applyReferenceRotation(variant as ModelReference, models);
        }

        if ((model.elements?.length ?? 0) === 0) {
            continue;
        }

        let name = `${
            blockstate.name
        }_generated_model_${generatedModelCount++}`;
        generatedModels.set(name, { name, data: model });
        newVariants.variants[key] = { model: "minecraft:block/" + name };
    }
    blockstate.data = newVariants;
}
