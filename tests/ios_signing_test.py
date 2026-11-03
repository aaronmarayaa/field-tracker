import datetime
import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location("ios_signing", ".github/scripts/prepare-ios-signing.py")
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)

TEAM = "ABCDEFGHIJ"
BUNDLE = "com.example.fieldtracker"
PROFILE_ID = "11111111-2222-3333-4444-555555555555"


class SigningConfigurationTests(unittest.TestCase):
    def profile(self):
        return {
            "TeamIdentifier": [TEAM],
            "ApplicationIdentifierPrefix": [TEAM],
            "UUID": PROFILE_ID,
            "Entitlements": {"application-identifier": f"{TEAM}.{BUNDLE}", "get-task-allow": False},
            "ExpirationDate": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
        }

    def test_app_store_profile_matches_team_and_exact_app(self):
        signing.validate_profile(self.profile(), TEAM, BUNDLE)
        with self.assertRaisesRegex(ValueError, "IOS_TEAM_ID"):
            signing.validate_profile(self.profile(), "WRONGTEAM1", BUNDLE)
        with self.assertRaisesRegex(ValueError, "IOS_BUNDLE_ID"):
            signing.validate_profile(self.profile(), TEAM, "com.other.app")

    def test_development_ad_hoc_and_expired_profiles_are_rejected(self):
        for key, value in [("ProvisionedDevices", ["device"]), ("ProvisionsAllDevices", True)]:
            profile = self.profile()
            profile[key] = value
            with self.assertRaisesRegex(ValueError, "distribution profile"):
                signing.validate_profile(profile, TEAM, BUNDLE)
        profile = self.profile()
        profile["Entitlements"]["get-task-allow"] = True
        with self.assertRaisesRegex(ValueError, "distribution profile"):
            signing.validate_profile(profile, TEAM, BUNDLE)
        profile = self.profile()
        profile["ExpirationDate"] = datetime.datetime(2000, 1, 1)
        with self.assertRaisesRegex(ValueError, "expired"):
            signing.validate_profile(profile, TEAM, BUNDLE)

    def test_signing_is_limited_to_the_app_build_configurations(self):
        project = Path("ios/App/App.xcodeproj/project.pbxproj").read_text()
        result = signing.configure_app(project, TEAM, "com.test.ios", PROFILE_ID, "12.3")
        self.assertEqual(result.count("CODE_SIGN_STYLE = Manual;"), 2)
        self.assertEqual(result.count(f'DEVELOPMENT_TEAM = {TEAM};'), 2)
        self.assertEqual(result.count(f'PROVISIONING_PROFILE_SPECIFIER = "{PROFILE_ID}";'), 2)
        self.assertEqual(result.count("PRODUCT_BUNDLE_IDENTIFIER = com.test.ios;"), 2)
        self.assertEqual(result.count("CURRENT_PROJECT_VERSION = 12.3;"), 2)
        self.assertEqual(result.count('CODE_SIGN_IDENTITY = "Apple Distribution";'), 2)
        self.assertEqual(result.count('CODE_SIGN_IDENTITY = "iPhone Developer";'), project.count('CODE_SIGN_IDENTITY = "iPhone Developer";'))
        self.assertEqual(signing.configure_app(result, TEAM, "com.test.ios", PROFILE_ID, "12.3"), result)

    def test_unknown_project_shape_fails_before_signing(self):
        with self.assertRaisesRegex(ValueError, "App target"):
            signing.configure_app("", TEAM, BUNDLE, PROFILE_ID, "1.1")


if __name__ == "__main__":
    unittest.main()
