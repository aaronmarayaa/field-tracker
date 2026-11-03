import datetime
import os
from pathlib import Path
import plistlib
import re
import shutil


def validate_profile(profile, team_id, bundle_id):
    if profile.get("TeamIdentifier") != [team_id]:
        raise ValueError("The provisioning profile must belong to IOS_TEAM_ID.")
    entitlements = profile.get("Entitlements", {})
    prefix = profile.get("ApplicationIdentifierPrefix", [team_id])[0]
    if entitlements.get("application-identifier") != f"{prefix}.{bundle_id}":
        raise ValueError("The provisioning profile must match IOS_BUNDLE_ID exactly.")
    if (entitlements.get("get-task-allow", False)
            or "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices")):
        raise ValueError("Use an App Store Connect distribution profile, not a development or Ad Hoc profile.")
    expires = profile.get("ExpirationDate")
    if expires is None or expires.replace(tzinfo=datetime.timezone.utc) <= datetime.datetime.now(datetime.timezone.utc):
        raise ValueError("The provisioning profile has expired or has no expiration date.")
    if not re.fullmatch(r"[A-Fa-f0-9-]{36}", profile.get("UUID", "")):
        raise ValueError("The provisioning profile UUID is invalid.")


def configure_app(project, team_id, bundle_id, profile_id, build_number):
    count = 0

    def configure(match):
        nonlocal count
        block = match.group()
        if "PRODUCT_BUNDLE_IDENTIFIER =" not in block:
            return block
        count += 1
        replacements = {
            "CODE_SIGN_STYLE": "Manual",
            "CURRENT_PROJECT_VERSION": build_number,
            "PRODUCT_BUNDLE_IDENTIFIER": bundle_id,
            "DEVELOPMENT_TEAM": team_id,
            "PROVISIONING_PROFILE_SPECIFIER": f'"{profile_id}"',
            "CODE_SIGN_IDENTITY": '"Apple Distribution"',
        }
        missing = []
        for key, value in replacements.items():
            pattern = rf"(\b{key} = )[^;]+;"
            if re.search(pattern, block):
                block = re.sub(pattern, rf"\g<1>{value};", block)
            else:
                missing.append(f"\n\t\t\t\t{key} = {value};")
        # Set signing on the app target only; Swift package resource bundles need no profile.
        return block.replace("buildSettings = {", "buildSettings = {" + "".join(missing), 1)

    result = re.sub(r"buildSettings = \{.*?\n\t\t\t\};", configure, project, flags=re.DOTALL)
    if count != 2:
        raise ValueError("Expected the App target's Debug and Release settings; check the Xcode project.")
    return result


def main():
    temp = Path(os.environ["RUNNER_TEMP"])
    team_id = os.environ["IOS_TEAM_ID"]
    bundle_id = os.environ["IOS_BUNDLE_ID"]
    key_id = os.environ["APP_STORE_CONNECT_KEY_ID"]
    if not re.fullmatch(r"[A-Z0-9]{10}", team_id):
        raise ValueError("IOS_TEAM_ID must be your ten-character Apple team ID.")
    if not re.fullmatch(r"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", bundle_id):
        raise ValueError("IOS_BUNDLE_ID must be your registered reverse-domain bundle ID.")
    if not re.fullmatch(r"[A-Z0-9]{10}", key_id):
        raise ValueError("APP_STORE_CONNECT_KEY_ID must be your ten-character API key ID.")

    profile = plistlib.loads((temp / "profile.plist").read_bytes())
    validate_profile(profile, team_id, bundle_id)
    profile_id = profile["UUID"]
    for folder in ("Library/MobileDevice/Provisioning Profiles", "Library/Developer/Xcode/UserData/Provisioning Profiles"):
        destination = Path.home() / folder
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(temp / "profile.mobileprovision", destination / f"{profile_id}.mobileprovision")
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as output:
        output.write(f"IOS_PROFILE_UUID={profile_id}\n")

    options = {
        "method": "app-store-connect",
        "destination": "export",
        "teamID": team_id,
        "signingStyle": "manual",
        "signingCertificate": "Apple Distribution",
        "provisioningProfiles": {bundle_id: profile_id},
        "manageAppVersionAndBuildNumber": False,
    }
    (temp / "ExportOptions.plist").write_bytes(plistlib.dumps(options))
    project = Path("ios/App/App.xcodeproj/project.pbxproj")
    build_number = f'{os.environ["GITHUB_RUN_NUMBER"]}.{os.environ["GITHUB_RUN_ATTEMPT"]}'
    project.write_text(configure_app(project.read_text(), team_id, bundle_id, profile_id, build_number))

    keys = temp / "private_keys"
    keys.mkdir(mode=0o700, exist_ok=True)
    key = keys / f"AuthKey_{key_id}.p8"
    key.write_text(os.environ["APP_STORE_CONNECT_PRIVATE_KEY"])
    key.chmod(0o600)


if __name__ == "__main__":
    main()
