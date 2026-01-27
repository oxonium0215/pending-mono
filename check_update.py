import os
import requests
import json
import sys

def get_latest_tag(repo):
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    headers = {}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()["tag_name"]
    except Exception as e:
        print(f"Error fetching latest tag for {repo}: {e}")
        return None

def bump_patch_version(version):
    parts = version.split('.')
    if len(parts) != 3:
        return version
    parts[2] = str(int(parts[2]) + 1)
    return '.'.join(parts)

def set_output(name, value):
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"{name}={value}\n")

def generate_release_notes(version, current, new):
    lines = []
    lines.append(f"Staged Mono v{version}")
    lines.append("")
    lines.append("Composite font of Commit Mono and BIZ UD Gothic.")
    lines.append("")
    lines.append("## Updates")
    lines.append("")
    
    if current["commit_mono"] != new["commit_mono"]:
        lines.append(f"*   Commit Mono: `{current['commit_mono']}` -> `{new['commit_mono']}`")
    else:
        lines.append(f"*   Commit Mono: `{current['commit_mono']}` (No Change)")
        
    if current["biz_ud_gothic"] != new["biz_ud_gothic"]:
        lines.append(f"*   BIZ UD Gothic: `{current['biz_ud_gothic']}` -> `{new['biz_ud_gothic']}`")
    else:
        lines.append(f"*   BIZ UD Gothic: `{current['biz_ud_gothic']}` (No Change)")
        
    if current["nerd_fonts"] != new["nerd_fonts"]:
        lines.append(f"*   Nerd Fonts: `{current['nerd_fonts']}` -> `{new['nerd_fonts']}`")
    else:
        lines.append(f"*   Nerd Fonts: `{current['nerd_fonts']}` (No Change)")
        
    lines.append("")
    lines.append("## Components")
    lines.append("")
    lines.append("*   [Commit Mono](https://github.com/eigilnikolajsen/commit-mono)")
    lines.append("*   [BIZ UD Gothic](https://github.com/googlefonts/morisawa-biz-ud-gothic)")
    lines.append("*   [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts)")
    
    return "\n".join(lines)

def main():
    if not os.path.exists("versions.json"):
        print("versions.json not found.")
        sys.exit(1)

    with open("versions.json", "r") as f:
        current_versions = json.load(f)

    print("Checking Commit Mono...")
    new_cm = get_latest_tag("eigilnikolajsen/commit-mono")
    print("Checking BIZ UD Gothic...")
    new_biz = get_latest_tag("googlefonts/morisawa-biz-ud-gothic")
    print("Checking Nerd Fonts...")
    new_nf = get_latest_tag("ryanoasis/nerd-fonts")

    new_versions = {
        "commit_mono": new_cm or current_versions["commit_mono"],
        "biz_ud_gothic": new_biz or current_versions["biz_ud_gothic"],
        "nerd_fonts": new_nf or current_versions["nerd_fonts"],
        "project_version": current_versions["project_version"]
    }

    # Check for updates
    has_changes = False
    force_update = "--force" in sys.argv

    if current_versions["commit_mono"] != new_versions["commit_mono"]:
        has_changes = True
        print(f"Commit Mono: {current_versions['commit_mono']} -> {new_versions['commit_mono']}")
    if current_versions["biz_ud_gothic"] != new_versions["biz_ud_gothic"]:
        has_changes = True
        print(f"BIZ UD Gothic: {current_versions['biz_ud_gothic']} -> {new_versions['biz_ud_gothic']}")
    if current_versions["nerd_fonts"] != new_versions["nerd_fonts"]:
        has_changes = True
        print(f"Nerd Fonts: {current_versions['nerd_fonts']} -> {new_versions['nerd_fonts']}")

    if has_changes or force_update:
        if force_update and not has_changes:
            print("Force update triggered.")
        
        new_project_version = bump_patch_version(current_versions["project_version"])
        new_versions["project_version"] = new_project_version
        print(f"New version: {new_project_version}")
        
        # Update build.ini VERSION
        if os.path.exists("build.ini"):
            with open("build.ini", "r") as f:
                lines = f.readlines()
            with open("build.ini", "w") as f:
                for line in lines:
                    if line.startswith("VERSION ="):
                        f.write(f"VERSION = {new_project_version}\n")
                    else:
                        f.write(line)
            print("Updated build.ini VERSION.")
        
        # Generate release notes
        notes = generate_release_notes(new_project_version, current_versions, new_versions)
        with open("release_notes.md", "w") as f:
            f.write(notes)
        
        # Save new state
        with open("versions_new.json", "w") as f:
            json.dump(new_versions, f, indent=2)
        
        set_output("should_build", "true")
        set_output("new_version", new_project_version)
        set_output("commit_mono_version", new_versions["commit_mono"])
        set_output("biz_ud_version", new_versions["biz_ud_gothic"])
        set_output("nerd_font_version", new_versions["nerd_fonts"])
    else:
        print("No updates detected.")
        set_output("should_build", "false")

if __name__ == "__main__":
    main()
