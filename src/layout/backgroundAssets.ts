import { Image } from "react-native";
import { BackgroundAsset } from "./backgroundTypes";
import { backgroundPacks } from "./backgroundPacks";

export type BackgroundAssetSelection = {
  packId: string;
  packLabel: string;
  asset: BackgroundAsset;
};

const backgroundAssetSources: Record<string, number> = {
"summer-vacation-01": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-01.svg"),
  "summer-vacation-02": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-02.svg"),
  "summer-vacation-03": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-03.svg"),
  "summer-vacation-04": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-04.svg"),
  "summer-vacation-05": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-05.svg"),
  "summer-vacation-06": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-06.svg"),
  "summer-vacation-07": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-07.svg"),
  "summer-vacation-08": require("../../assets/backgroundPacks/summer-vacation/assets/summer-vacation-08.svg"),
  "winter-get-away-01": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-01.svg"),
  "winter-get-away-02": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-02.svg"),
  "winter-get-away-03": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-03.svg"),
  "winter-get-away-04": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-04.svg"),
  "winter-get-away-05": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-05.svg"),
  "winter-get-away-06": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-06.svg"),
  "winter-get-away-07": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-07.svg"),
  "winter-get-away-08": require("../../assets/backgroundPacks/winter-get-away/assets/winter-get-away-08.svg"),
  "everyday-clean-01": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-01.svg"),
  "everyday-clean-02": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-02.svg"),
  "everyday-clean-03": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-03.svg"),
  "everyday-clean-04": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-04.svg"),
  "everyday-clean-05": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-05.svg"),
  "everyday-clean-06": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-06.svg"),
  "everyday-clean-07": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-07.svg"),
  "everyday-clean-08": require("../../assets/backgroundPacks/everyday-clean/assets/everyday-clean-08.svg"),
  "birthday-party-01": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-01.svg"),
  "birthday-party-02": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-02.svg"),
  "birthday-party-03": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-03.svg"),
  "birthday-party-04": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-04.svg"),
  "birthday-party-05": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-05.svg"),
  "birthday-party-06": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-06.svg"),
  "birthday-party-07": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-07.svg"),
  "birthday-party-08": require("../../assets/backgroundPacks/birthday-party/assets/birthday-party-08.svg"),
  "baby-toddler-01": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-01.svg"),
  "baby-toddler-02": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-02.svg"),
  "baby-toddler-03": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-03.svg"),
  "baby-toddler-04": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-04.svg"),
  "baby-toddler-05": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-05.svg"),
  "baby-toddler-06": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-06.svg"),
  "baby-toddler-07": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-07.svg"),
  "baby-toddler-08": require("../../assets/backgroundPacks/baby-toddler/assets/baby-toddler-08.svg"),
  "spring-day-01": require("../../assets/backgroundPacks/spring-day/assets/spring-day-01.svg"),
  "spring-day-02": require("../../assets/backgroundPacks/spring-day/assets/spring-day-02.svg"),
  "spring-day-03": require("../../assets/backgroundPacks/spring-day/assets/spring-day-03.svg"),
  "spring-day-04": require("../../assets/backgroundPacks/spring-day/assets/spring-day-04.svg"),
  "spring-day-05": require("../../assets/backgroundPacks/spring-day/assets/spring-day-05.svg"),
  "spring-day-06": require("../../assets/backgroundPacks/spring-day/assets/spring-day-06.svg"),
  "spring-day-07": require("../../assets/backgroundPacks/spring-day/assets/spring-day-07.svg"),
  "spring-day-08": require("../../assets/backgroundPacks/spring-day/assets/spring-day-08.svg"),
  "school-days-01": require("../../assets/backgroundPacks/school-days/assets/school-days-01.svg"),
  "school-days-02": require("../../assets/backgroundPacks/school-days/assets/school-days-02.svg"),
  "school-days-03": require("../../assets/backgroundPacks/school-days/assets/school-days-03.svg"),
  "school-days-04": require("../../assets/backgroundPacks/school-days/assets/school-days-04.svg"),
  "school-days-05": require("../../assets/backgroundPacks/school-days/assets/school-days-05.svg"),
  "school-days-06": require("../../assets/backgroundPacks/school-days/assets/school-days-06.svg"),
  "school-days-07": require("../../assets/backgroundPacks/school-days/assets/school-days-07.svg"),
  "school-days-08": require("../../assets/backgroundPacks/school-days/assets/school-days-08.svg"),
  "fall-cozy-01": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-01.svg"),
  "fall-cozy-02": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-02.svg"),
  "fall-cozy-03": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-03.svg"),
  "fall-cozy-04": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-04.svg"),
  "fall-cozy-05": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-05.svg"),
  "fall-cozy-06": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-06.svg"),
  "fall-cozy-07": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-07.svg"),
  "fall-cozy-08": require("../../assets/backgroundPacks/fall-cozy/assets/fall-cozy-08.svg")
};

const selectionsById = new Map<string, BackgroundAssetSelection>();

for (const pack of backgroundPacks) {
  for (const asset of pack.backgrounds) {
    selectionsById.set(asset.id, {
      packId: pack.id,
      packLabel: pack.label,
      asset
    });
  }
}

export function getBackgroundAssetSelection(id: string | undefined): BackgroundAssetSelection | undefined {
  return id ? selectionsById.get(id) : undefined;
}

export function getBackgroundAssetSourceUri(id: string | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  const source = backgroundAssetSources[id];
  if (!source) {
    return undefined;
  }
  return Image.resolveAssetSource(source)?.uri;
}
