import { useEffect, useState } from "react";
import { Box } from "../../../common/Box/Box";
import { Button } from "../../../common/Button/Button";
import { FileSelector } from "../../../common/FileSelector/FileSelector";
import { Selector } from "../../../common/Selector/Selector";
import { Color } from "../../../data/color";
import { proxyfetch } from "../../../data/proxyfetch";
import { generateResourcepack } from "../../../data/resourcepack/generator";

interface Version {
    id: string,
    type: "release" | "snapshot",
    url: string,
}

interface VersionJSON {
    downloads: {
        client: {
            url: string;
        };
    };
}

interface Manifest {
    versions: Version[],
}

export function Resourcepack() {
    const [loading, setLoading] = useState(true);
    const [versions, setVersions] = useState<Version[]>([]);
    
    const [selectedVersion, setSelectedVersion] = useState("");
    const [selectedJar, setSelectedJar] = useState<File | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedSkin, setSelectedSkin] = useState<File | null>(null);
    
    useEffect(() => {
        proxyfetch("https://piston-meta.mojang.com/mc/game/version_manifest.json")
            .then(res => res.json())
            .then((manifest: Manifest) => {
                setVersions(manifest.versions
                    .filter(version => version.type !== "snapshot")
                    .filter(version => version.id.startsWith("1.") && parseInt(version.id.split(".")[1]) >= 17));
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                // TODO: Implement error popup
            });
    }, []);
        
    const versionSelectorData = loading ? [{
        id: "loading", 
        title: "Loading...",
    }] : versions.map(version => ({
        id: version.id, 
        title: version.id
    }));
    
    return (
        <Box width={80} height={50} background={Color.Gray} text={Color.White} borderColor={Color.Black} border padded scrollable>
            <Box width={20} />
            <Box width={34}>
                <pre>
                    &nbsp;_   _         _____       _____   <br/>
                         | | | |       | ___ \     |_   _|  <br/>
                         | | | |       | |_/ /       | |    <br/>
                         | | | |       |  __/        | |    <br/>
                         \ \_/ /       | |           | |    <br/>
                    &nbsp;\___/ anilla \_|udding     \_/art <br/>
                    <br />
                    &nbsp;     Resourcepack generator
                </pre>
            </Box>
            <Box width={21} height={11} />
            <br />
            <span><u>Steps:</u></span><br />
            <br />
            <span>1.) Download the jar file for the version you want to use (leave it on the latest version unless you have any specific reason not to)</span><br />
            <br />
            <label htmlFor="version-select">Select version:  </label>
            <Selector id="version-select" options={versionSelectorData} onSelect={setSelectedVersion} /><br />
            <br />
            <Button title="Download version" onClick={async () => {
                const url = versions.find(version => version.id === selectedVersion)?.url ?? "";
                const versionJSON = await proxyfetch(url)
                    .then(res => res.json()) as VersionJSON;
                window.open(versionJSON.downloads.client.url, "_blank")?.focus();
            }} />
            <br />
            <br />
            
                <span>2.) Select the file you just downloaded (ending in a jar):</span><br />
                <br />
                <label htmlFor="jar-selector">Select jar file: </label><br /><br />
                <FileSelector id="jar-selector" extension="jar" onSelect={setSelectedJar} /><br />
                <br />
                <br />
                <span>3.) Select the resourcepack you wish to apply on top of the vanilla assets</span><br />
                <br />
                <label htmlFor="file-selector">Select resourcepack: </label><br /><br />
                <FileSelector id="file-selector" extension="zip" onSelect={setSelectedFile} /><br />
                <br />
                <Box width={75} height={7} background={Color.Purple} border padded borderColor={Color.Black}>
                    <span>3.5) (Optional) Select your skin:</span><br />
                    <br />
                    <FileSelector id="skin-selector" extension="png" onSelect={setSelectedSkin} />
                </Box>
                <br />
                <br />
                <Box width={75} height={1} />
                <span>4.) Generate the resourcepack</span><br />
                <br />
                <Button onClick={() => {
                        if (selectedJar && selectedFile)
                            generateResourcepack(selectedJar, selectedFile, selectedSkin);
                    }} title="Generate pack" /><br />
                <br />
                <br />
                <span>5.) Load the downloaded resourcepack ON TOP of VanillaPuddingTart</span><br />
                <br />
                <span>Don't share the generated file with anyone unless you have explicit permission</span><br />
                <br />
        </Box>
    )
}