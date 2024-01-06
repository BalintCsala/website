import type { FileRef } from "./file.ts";
import {
    mergeModels,
    applyReferenceRotation,
} from "./model.ts";
import type {
    ModelReference, ModelStorage
} from "./model.ts"
import type { Variants } from "./variants.ts";

type Case = { [key: string]: string };

export type Multipart = {
    multipart: {
        when?:
            | Case
            | {
                  OR: Case[];
              };
        apply: ModelReference | ModelReference[];
    }[];
};

function checkMatch(combination: Case, base: Case) {
    for (let key in combination) {
        if (key in base && combination[key] !== base[key]) return false;
    }
    return true;
}

function caseToVariant(combination: Case) {
    const parts = [];
    for (const key in combination) {
        parts.push(`${key}=${combination[key]}`);
    }
    return parts.join(",");
}

export function convertMultipartToVariant(
    blockstate: FileRef<Multipart>,
    models: ModelStorage
) {
    const multipart = blockstate.data;
    const parts = multipart.multipart;

    const conditions = new Map<string, Set<string>>();
    parts.forEach((part) => {
        if (!part.when) return;

        const cases =
            part.when.OR instanceof Array ? part.when.OR : [part.when as Case];
        cases.forEach((cas) => {
            for (let key in cas) {
                // TODO: Handle AND
                if (key === "AND") continue;

                if (!conditions.has(key)) {
                    conditions.set(key, new Set());
                }

                for (let value of cas[key]!.split("|")) {
                    if (value === "true") {
                        conditions.get(key)?.add("false");
                    }
                    if (!isNaN(parseInt(value))) {
                        conditions.get(key)?.add("0");
                    }
                    conditions.get(key)?.add(value);
                }
            }
        });
    });

    const conditionEntries = [...conditions].map(([key, values]) => [
        key,
        Array.from(values),
    ]) as [string, string[]][];
    let combinationCount = 1;
    conditionEntries.forEach(([, values]) => {
        combinationCount *= values.length;
    });

    let counter = 0;

    const combinations = [];
    while (counter < combinationCount) {
        let copy = counter;
        const combination: { [key: string]: string } = {};
        conditionEntries.forEach(([key, values]) => {
            combination[key] = values[copy % values.length]!;
            copy = Math.floor(copy / values.length);
        });
        combinations.push(combination);
        counter++;
    }

    const generatedReferences = new Map<string, ModelReference>();
    const variants: FileRef<Variants> = {
        name: blockstate.name,
        data: {
            variants: {},
        },
    };

    combinations.forEach((combination) => {
        let key = "";
        const usedModels: ModelReference[] = [];
        parts.forEach((part) => {
            if (!part.when) {
                key += "1";
                if (part.apply instanceof Array) {
                    usedModels.push(...part.apply);
                } else {
                    usedModels.push(part.apply);
                }
                return;
            }

            const cases =
                part.when.OR instanceof Array
                    ? part.when.OR
                    : [part.when as Case];
            const matches = cases.some((cas) => checkMatch(combination, cas));
            if (!matches) {
                key += "0";
                return;
            }

            key += "1";
            if (part.apply instanceof Array) {
                usedModels.push(...part.apply);
            } else {
                usedModels.push(part.apply);
            }
        });

        if (usedModels.length === 0) return;

        const variantKey = caseToVariant(combination);
        if (!generatedReferences.has(key)) {
            const mergedModel = mergeModels(
                usedModels.map((reference) =>
                    applyReferenceRotation(reference, models)
                )
            );

            const name = `${blockstate.name}_generated_model_${generatedReferences.size}`;
            models.set(name, { name, data: mergedModel! });
            generatedReferences.set(key, { model: "minecraft:block/" + name });
        }
        variants.data.variants[variantKey] = generatedReferences.get(key)!;
    });

    return variants;
}
