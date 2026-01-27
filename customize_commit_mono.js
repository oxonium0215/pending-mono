const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

// Configuration corresponding to websiteData
const featuresConfig = [
    { type: "alternate", name: "a", feature: "cv01" },
    { type: "alternate", name: "g", feature: "cv02" },
    { type: "alternate", name: "square", feature: "cv03" },
    { type: "alternate", name: "i", feature: "cv04" },
    { type: "alternate", name: "at", feature: "cv05" },
    { type: "alternate", name: "six", feature: "cv06" },
    { type: "alternate", name: "zero", feature: "cv07" },
    { type: "alternate", name: "slanted", feature: "cv08" },
    { type: "alternate", name: "asterisk", feature: "cv09" },
    { type: "alternate", name: "l", feature: "cv10" },
    { type: "alternate", name: "one", feature: "cv11" },
    { type: "feature", name: "less_equal", feature: "ss01" },
    { type: "feature", name: "arrows", feature: "ss02" },
    { type: "feature", name: "case", feature: "ss03" },
    { type: "feature", name: "ellipsis", feature: "ss04" },
    { type: "feature", name: "smartkerning", feature: "ss05" },
];

async function main() {
    const args = process.argv.slice(2);
    let inputDir = './source_fonts/fontlab';
    let outputDir = './source_fonts/commit-mono';
    let featuresList = '';
    let letterSpacing = 0;
    let lineHeight = 1.0;
    let regWeight = "400";
    let boldWeight = "700";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--input-dir') inputDir = args[++i];
        else if (args[i] === '--output-dir') outputDir = args[++i];
        else if (args[i] === '--features') featuresList = args[++i];
        else if (args[i] === '--letter-spacing') letterSpacing = parseFloat(args[++i]);
        else if (args[i] === '--line-height') lineHeight = parseFloat(args[++i]);
        else if (args[i] === '--regular-weight') regWeight = args[++i] || "400";
        else if (args[i] === '--bold-weight') boldWeight = args[++i] || "700";
    }

    // Default values fallback for empty strings from actions
    if (!regWeight) regWeight = "400";
    if (!boldWeight) boldWeight = "700";

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Parse features list
    const activeFeatures = {};
    const activeAlternates = {};
    // ... (rest of feature parsing)
    const requestedFeatures = featuresList.split(',').map(s => s.trim()).filter(Boolean);

    requestedFeatures.forEach(req => {
        const config = featuresConfig.find(c => c.feature === req || c.name === req);
        if (config) {
            if (config.type === 'alternate') activeAlternates[config.feature] = true;
            if (config.type === 'feature') activeFeatures[config.feature] = true;
        }
    });

    console.log('Active Alternates:', activeAlternates);
    console.log('Active Features:', activeFeatures);
    console.log('Weights:', regWeight, boldWeight);

    const styles = [
        { pattern: `${regWeight}Regular.otf`, output: `CommitMono-${regWeight}-Regular.otf`, weight: parseInt(regWeight), italic: false, styleName: 'Regular' },
        { pattern: `${regWeight}Italic.otf`, output: `CommitMono-${regWeight}-Italic.otf`, weight: parseInt(regWeight), italic: true, styleName: 'Italic' },
        { pattern: `${boldWeight}Regular.otf`, output: `CommitMono-${boldWeight}-Regular.otf`, weight: parseInt(boldWeight), italic: false, styleName: 'Bold' },
        { pattern: `${boldWeight}Italic.otf`, output: `CommitMono-${boldWeight}-Italic.otf`, weight: parseInt(boldWeight), italic: true, styleName: 'Bold Italic' }
    ];

    for (const style of styles) {
        // Find file matching pattern in inputDir
        const files = fs.readdirSync(inputDir);
        const matchedFile = files.find(f => f.endsWith(style.pattern));
        
        if (!matchedFile) {
            console.error(`File with pattern ${style.pattern} not found in ${inputDir}`);
            console.error(`Available files: ${files.join(', ')}`);
            continue;
        }

        const inputPath = path.join(inputDir, matchedFile);
        const outputPath = path.join(outputDir, style.output);

        console.log(`Processing ${matchedFile}...`);
        const buffer = fs.readFileSync(inputPath);
        const font = opentype.parse(buffer.buffer);

        // Apply transformations
        processFont(font, {
            alternates: activeAlternates,
            features: activeFeatures,
            letterSpacing,
            lineHeight,
            weight: style.weight,
            style: style.styleName,
            italic: style.italic
        });

        const outputBuffer = Buffer.from(font.toArrayBuffer());
        fs.writeFileSync(outputPath, outputBuffer);
        console.log(`Saved to ${outputPath}`);
    }
}

function processFont(font, settings) {
    // 1. Alternates (Swap paths)
    Object.entries(settings.alternates)
        .reverse()
        .forEach(([alternate, active]) => {
            if (!active) return;
            
            font.tables.gsub.features.forEach(feature => {
                if (feature.tag === alternate) {
                    feature.feature.lookupListIndexes.forEach(lookupIndex => {
                        const lookup = font.tables.gsub.lookups[lookupIndex];
                        lookup.subtables.forEach(subtable => {
                            let glyphs = [];
                            if (subtable.coverage.format === 1) {
                                glyphs = subtable.coverage.glyphs;
                            } else if (subtable.coverage.format === 2) {
                                glyphs = subtable.coverage.ranges.flatMap(range => 
                                    Array.from({length: range.end - range.start + 1}, (_, i) => range.start + i)
                                );
                            }

                            glyphs.forEach((glyphIndexOriginal, index) => {
                                const glyphIndexSubstitute = subtable.substitute[index];
                                const glyphOriginal = font.glyphs.glyphs[glyphIndexOriginal];
                                const glyphSubstitute = font.glyphs.glyphs[glyphIndexSubstitute];
                                
                                const pathOriginal = glyphOriginal.path;
                                const pathSubstitute = glyphSubstitute.path;

                                glyphOriginal.path = pathSubstitute;
                                glyphSubstitute.path = pathOriginal;
                            });
                        });
                    });
                }
            });
        });

    // 2. Dimensions (Width & Height)
    const newWidthMoveAmount = settings.letterSpacing * 5;
    const newWidthDecrease = settings.letterSpacing * 10;
    const defaultWidth = 600; 
    // Note: Commit Mono V143 might have different defaults, but we assume 600 based on download_wizard.js
    // Let's check font.defaultWidthX if possible, but the JS hardcodes 600.
    const newWidth = defaultWidth + settings.letterSpacing * 10;

    // Iterate over all glyphs
    for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs.glyphs[i];
        if (!glyph) continue;

        // Modify path for width
        glyph.path.commands.forEach(command => {
            if (command.type === 'M' || command.type === 'L') {
                command.x += newWidthMoveAmount;
            }
            if (command.type === 'C' || command.type === 'Q') {
                command.x += newWidthMoveAmount;
                if (command.x1 !== undefined) command.x1 += newWidthMoveAmount;
                if (command.x2 !== undefined) command.x2 += newWidthMoveAmount;
            }
        });
        
        glyph.leftSideBearing += newWidthMoveAmount;
        glyph.advanceWidth = newWidth;
    }

    font.defaultWidthX = newWidth;
    // font.tables.cff.topDict._defaultWidthX = newWidth; // opentype.js might not expose this easily
    if (font.tables.head) {
        font.tables.head.yMax += newWidthMoveAmount;
        font.tables.head.yMin += newWidthMoveAmount;
    }
    if (font.tables.hhea) {
        font.tables.hhea.advanceWidthMax = newWidth;
        font.tables.hhea.minLeftSideBearing += newWidthMoveAmount;
        font.tables.hhea.minRightSideBearing += newWidthMoveAmount;
        font.tables.hhea.xMaxExtent += newWidthDecrease;
    }
    if (font.tables.os2) {
        font.tables.os2.xAvgCharWidth = newWidth;
    }

    // Change Height
    const newHeightOffset = settings.lineHeight * 500 - 500;
    font.ascender += newHeightOffset;
    font.descender -= newHeightOffset;
    if (font.tables.hhea) {
        font.tables.hhea.ascender += newHeightOffset;
        font.tables.hhea.descender -= newHeightOffset;
    }
    if (font.tables.os2) {
        font.tables.os2.sTypoAscender += newHeightOffset;
        font.tables.os2.sTypoDescender -= newHeightOffset;
        font.tables.os2.usWinAscent += newHeightOffset;
        font.tables.os2.usWinDescent += newHeightOffset;
    }

    // 3. Features (calt injection)
    // Create empty calt feature
    const emptyCalt = { tag: 'calt', feature: { featureParams: 0, lookupListIndexes: [] } };
    font.tables.gsub.features.push(emptyCalt);
    const caltLookupIndexes = [];

    Object.entries(settings.features).forEach(([alternate, active]) => {
        if (!active) return;
        font.tables.gsub.features.forEach(feature => {
            if (feature.tag === alternate) {
                feature.feature.lookupListIndexes.forEach(idx => caltLookupIndexes.push(idx));
            }
        });
    });

    // Assign to calt
    font.tables.gsub.features.forEach(feature => {
        if (feature.tag === 'calt') {
            feature.feature.lookupListIndexes = caltLookupIndexes;
        }
    });
    
    // Add calt to scripts
    font.tables.gsub.scripts.forEach(script => {
        if (script.script.defaultLangSys) {
             script.script.defaultLangSys.featureIndexes.push(font.tables.gsub.features.length - 1);
        }
        // Also iterate langSysRecords if any
        if (script.script.langSysRecords) {
            script.script.langSysRecords.forEach(record => {
                record.langSys.featureIndexes.push(font.tables.gsub.features.length - 1);
            });
        }
    });

    // 4. Update names (Simplified compared to wizard)
    const fontName = "CommitMono"; // We keep the name simple for merging script
    // Note: The wizard changes the name to include version. We should stick to what build.ini expects or update build.ini.
    // build.ini expects "CommitMono-Regular.otf" etc.
    
    // We don't need to change internal names heavily because the merging script will set the final name to "Pending Mono".
    // However, it's good practice to update them to reflect it's modified.
    
    font.names.fontFamily = { en: fontName };
    font.names.fontSubfamily = { en: settings.style };
    font.names.fullName = { en: `${fontName} ${settings.style}` };
    font.names.postScriptName = { en: `${fontName}-${settings.style.replace(' ', '')}` };
}

main().catch(console.error);
