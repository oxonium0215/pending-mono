#!/bin/bash
set -e

# Cleanup build and dist
rm -rf build dist
mkdir -p dist

# Determine Python interpreter
PYTHON_EXE=python3

if [ -z "$GITHUB_ACTIONS" ]; then
    # Ensure dependencies locally
    if [ ! -d "node_modules" ]; then
        echo "Installing Node.js dependencies..."
        npm install
    fi

    if [ ! -d "venv" ]; then
        echo "Creating virtual environment and installing Python dependencies..."
        python3 -m venv venv
        ./venv/bin/pip install -r requirements.txt
    fi
    
    if [ -d "venv" ]; then
        PYTHON_EXE=./venv/bin/python3
    fi
else
    echo "Running in GitHub Actions, using system Python."
fi

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
    $PYTHON_EXE fonttools_script.py

    # 4. Rename and Move
    echo "  Moving artifacts..."
    
    for f in build/*.ttf; do
        style=""
        if [[ "$f" == *"Regular.ttf" ]]; then style="Regular"; fi
        if [[ "$f" == *"Bold.ttf" ]]; then style="Bold"; fi
        if [[ "$f" == *"Italic.ttf" ]]; then style="Italic"; fi
        if [[ "$f" == *"BoldItalic.ttf" ]]; then style="BoldItalic"; fi
        
        if [ -n "$style" ]; then
            new_name="${variant_name}-${style}.ttf"
            mv "$f" "dist/${new_name}"
        fi
    done

    # 5. Zip the variant
    echo "  Zipping ${variant_name}..."
    $PYTHON_EXE -c "import zipfile, glob, os; \
        z = zipfile.ZipFile('dist/${variant_name}.zip', 'w', zipfile.ZIP_DEFLATED); \
        files = glob.glob('dist/${variant_name}-*.ttf'); \
        [z.write(f, os.path.basename(f)) for f in files]; \
        z.close()"
    
    # Remove individual TTFs to keep dist clean (only keep zips)
    # rm dist/${variant_name}-*.ttf

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
