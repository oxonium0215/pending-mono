#!/bin/bash
set -e

# Cleanup build and dist
rm -rf build dist
mkdir -p dist

# Function to build a variant
build_variant() {
    local variant_name=$1
    local features=$2
    local ff_options=$3

    echo "Building ${variant_name}..."
    
    # 1. Customize Commit Mono
    echo "  Customizing Commit Mono..."
    node customize_commit_mono.js --features "${features}" --letter-spacing 0 --line-height 1.0

    # 2. Build with FontForge
    echo "  Running FontForge..."
    fontforge -script fontforge_script.py ${ff_options}

    # 3. Post-process with FontTools
    echo "  Running FontTools..."
    python3 fonttools_script.py

    # 4. Rename and Move
    echo "  Moving artifacts..."
    
    for f in build/*.ttf; do
        if [[ "$f" == *"Regular.ttf" ]]; then style="Regular"; fi
        if [[ "$f" == *"Bold.ttf" ]]; then style="Bold"; fi
        if [[ "$f" == *"Italic.ttf" ]]; then style="Italic"; fi
        if [[ "$f" == *"BoldItalic.ttf" ]]; then style="BoldItalic"; fi
        
        new_name="${variant_name}-${style}.ttf"
        mv "$f" "dist/${new_name}"
    done

    # 5. Zip the variant
    echo "  Zipping ${variant_name}..."
    # We use -j to store only files without directory structure
    zip -j "dist/${variant_name}.zip" dist/${variant_name}-*.ttf
    
    # Remove individual TTFs to keep dist clean (only keep zips)
    rm dist/${variant_name}-*.ttf

    # Clean build dir for next run
    rm -rf build/*
}

# Features Definition
FEAT_DEFAULT="ss03,ss04,ss05"
FEAT_LIGATURE="ss01,ss02,ss03,ss04,ss05"

# --- Group A: Default (No Ligatures) ---

# 1. StagedMono35NF (3:5, Standard)
build_variant "StagedMono35NF" "${FEAT_DEFAULT}" "--nerd-font --jpdoc"

# 2. StagedMono35NFConsole (3:5, Console)
build_variant "StagedMono35NFConsole" "${FEAT_DEFAULT}" "--nerd-font"

# 3. StagedMonoNF (1:2, Standard)
build_variant "StagedMonoNF" "${FEAT_DEFAULT}" "--nerd-font --half-width --jpdoc"

# 4. StagedMonoNFConsole (1:2, Console)
build_variant "StagedMonoNFConsole" "${FEAT_DEFAULT}" "--nerd-font --half-width"


# --- Group B: Ligature (With Ligatures) ---

# 5. StagedMono35LigNF (3:5, Standard)
build_variant "StagedMono35LigNF" "${FEAT_LIGATURE}" "--nerd-font --jpdoc"

# 6. StagedMono35LigNFConsole (3:5, Console)
build_variant "StagedMono35LigNFConsole" "${FEAT_LIGATURE}" "--nerd-font"

# 7. StagedMonoLigNF (1:2, Standard)
build_variant "StagedMonoLigNF" "${FEAT_LIGATURE}" "--nerd-font --half-width --jpdoc"

# 8. StagedMonoLigNFConsole (1:2, Console)
build_variant "StagedMonoLigNFConsole" "${FEAT_LIGATURE}" "--nerd-font --half-width"

echo "All builds completed. Files in dist/:"
ls -1 dist/
