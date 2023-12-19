import { withoutNils } from "@/wab/common";
import { arrayReversed } from "@/wab/commons/collections";
import { HostLessPackageInfo } from "@/wab/devflags";
import { smartHumanize } from "@/wab/strs";
import { merge } from "lodash";
import {
  PublicStyleSection,
  StyleSectionVisibilities,
  TemplateSpec,
} from "./ApiSchema";
import {
  FRAME_CAP,
  FREE_CONTAINER_CAP,
  HORIZ_CONTAINER_CAP,
  LAYOUT_CONTAINER_CAP,
  VERT_CONTAINER_CAP,
} from "./Labels";

export const BASIC_ALIASES = [
  "box",
  "columns",
  "frame",
  "grid",
  "heading",
  "hstack",
  "icon",
  "image",
  "link",
  "linkContainer",
  "section",
  "text",
  "vstack",
] as const;

export function makeNiceAliasName(alias: InsertAlias) {
  if (alias === "box") {
    return FREE_CONTAINER_CAP;
  } else if (alias === "hstack") {
    return HORIZ_CONTAINER_CAP;
  } else if (alias === "vstack") {
    return VERT_CONTAINER_CAP;
  } else if (alias === "columns") {
    return "Responsive columns";
  } else if (alias === "frame") {
    return FRAME_CAP;
  } else if (alias === "section") {
    return LAYOUT_CONTAINER_CAP;
  }
  return smartHumanize(alias);
}

export type InsertBasicAlias = (typeof BASIC_ALIASES)[number];

export const COMPONENT_ALIASES = [
  "accordion",
  "alert",
  "appLayout",
  "button",
  "buttonGroup",
  "calendar",
  "card",
  "carousel",
  "chart",
  "checkbox",
  "collapse",
  "countdown",
  "dataDetails",
  "dataFetcher",
  "dataGrid",
  "dataList",
  "dataProvider",
  "dateTimePicker",
  "dialog",
  "drawer",
  "embedCss",
  "embedHtml",
  "form",
  "iframe",
  "input",
  "linkPreview",
  "loadingBoundary",
  "lottie",
  "marquee",
  "navbar",
  "numberInput",
  "pageMeta",
  "parallax",
  "passwordInput",
  "popover",
  "radioGroup",
  "reveal",
  "richText",
  "select",
  "statistic",
  "switch",
  "table",
  "tilt3d",
  "timer",
  "tooltip",
  "upload",
  "video",
  "youtube",
] as const;

export type InsertComponentAlias = (typeof COMPONENT_ALIASES)[number];

export type InsertAlias = InsertBasicAlias | InsertComponentAlias;

export const LEFT_TAB_PANEL_KEYS = [
  "outline",
  "components",
  "tokens",
  "mixins",
  "fonts",
  "themes",
  "images",
  "responsiveness",
  "imports",
  "versions",
  "settings",
  "splits",
  "lint",
  "copilot",
] as const;

export type LeftTabKey = (typeof LEFT_TAB_PANEL_KEYS)[number];

export const LEFT_TAB_BUTTON_KEYS = [...LEFT_TAB_PANEL_KEYS, "figma"] as const;
export type LeftTabButtonKey = (typeof LEFT_TAB_BUTTON_KEYS)[number];

export interface UiConfig {
  styleSectionVisibilities?: Partial<StyleSectionVisibilities>;
  canInsertBasics?: Record<InsertBasicAlias, boolean> | boolean;
  canInsertBuiltinComponent?: Record<InsertComponentAlias, boolean> | boolean;
  canInsertHostless?: Record<string, boolean> | boolean;
  pageTemplates?: TemplateSpec[];
  insertableTemplates?: TemplateSpec[];
  leftTabs?: Record<LeftTabButtonKey, "hidden" | "readable" | "writable">;
  brand?: {
    logoImgSrc?: string;
    logoHref?: string;
    logoAlt?: string;
    logoTooltip?: string;
  };
}

/**
 * Merges UiConfigs, where the later ones in the array overwrites earlier ones
 */
export function mergeUiConfigs(
  ...configs_: (UiConfig | null | undefined)[]
): UiConfig {
  const configs = withoutNils(configs_);
  const mergedFirst = <T>(vals: (T | undefined)[]): T | undefined => {
    return arrayReversed(vals).find((x) => x != null);
  };
  const mergeBooleanObjs = (
    objs: (Record<string, boolean> | boolean | undefined | null)[]
  ) => {
    let res: Record<string, boolean> | boolean | undefined = undefined;
    for (const obj of objs) {
      if (obj == null) {
        continue;
      } else if (res == null) {
        res = obj;
      } else if (typeof obj === "boolean" || typeof res === "boolean") {
        res = obj;
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (val == null) {
            // no opinion on value of key, so ignore
          } else {
            res[key] = val;
          }
        }
      }
    }
    return res;
  };
  const mergeshallowObjs = <T>(
    objs: (Record<string, T> | undefined | null)[]
  ) => {
    let res: Record<string, T> | undefined = undefined;
    for (const obj of objs) {
      if (obj == null) {
        continue;
      } else if (res == null) {
        res = obj;
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (val == null) {
            // no opinion on value of key, so ignore
          } else {
            res[key] = val;
          }
        }
      }
    }
    return res;
  };
  return {
    styleSectionVisibilities: mergeBooleanObjs(
      configs.map((c) => c.styleSectionVisibilities)
    ) as Partial<StyleSectionVisibilities>,
    canInsertBasics: mergeBooleanObjs(configs.map((c) => c.canInsertBasics)),
    canInsertBuiltinComponent: mergeBooleanObjs(
      configs.map((c) => c.canInsertBuiltinComponent)
    ),
    canInsertHostless: mergeBooleanObjs(
      configs.map((c) => c.canInsertHostless)
    ),
    leftTabs: mergeshallowObjs(configs.map((c) => c.leftTabs)),
    pageTemplates: mergedFirst(configs.map((c) => c.pageTemplates)),
    insertableTemplates: mergedFirst(configs.map((c) => c.insertableTemplates)),
    // Deep merge `brand`
    brand: merge({}, ...configs.map((c) => c.brand)),
  };
}

type SectionedAliases = Record<string, Record<string, InsertAlias[]>>;

export interface InsertPanelConfig {
  aliases: Partial<Record<InsertComponentAlias, string>>;
  builtinSections: SectionedAliases;
  overrideSections: {
    website?: SectionedAliases;
    app?: SectionedAliases;
  };
}

function resolveBooleanPreference<T>(
  prefs: undefined | null | boolean | T,
  resolve: (prefs: T) => boolean | undefined,
  defaultAnswer: boolean
) {
  if (prefs == null) {
    return defaultAnswer;
  } else if (typeof prefs === "boolean") {
    return prefs;
  } else {
    return resolve(prefs) ?? defaultAnswer;
  }
}

function isComponentAlias(alias: InsertAlias): alias is InsertComponentAlias {
  return COMPONENT_ALIASES.includes(alias as any);
}

export function canEditStyleSection(
  config: UiConfig,
  section: PublicStyleSection,
  opts: {
    isContentCreator: boolean;
    defaultContentEditorVisible: boolean | undefined;
  }
) {
  const defaultAnswer = opts.isContentCreator
    ? !!opts.defaultContentEditorVisible
    : true;
  return resolveBooleanPreference(
    config.styleSectionVisibilities,
    (prefs) => prefs[section],
    defaultAnswer
  );
}

export function canInsertHostlessPackage(
  config: UiConfig,
  pkgName: string,
  opts: {
    insertPanel: InsertPanelConfig;
    hostlessPackages: HostLessPackageInfo[];
    isContentCreator: boolean;
  }
) {
  const defaultAnswer = opts.isContentCreator ? false : true;
  return resolveBooleanPreference(
    config.canInsertHostless,
    (hostlessPrefs) => hostlessPrefs[pkgName ?? ""],
    defaultAnswer
  );
}

export function canInsertAlias(
  config: UiConfig,
  alias: InsertAlias,
  opts: {
    insertPanel: InsertPanelConfig;
    hostlessPackages: HostLessPackageInfo[];
    isContentCreator: boolean;
  }
): boolean {
  const defaultAnswer = opts.isContentCreator ? false : true;
  if (isComponentAlias(alias)) {
    // a special / code component
    return resolveBooleanPreference(
      config.canInsertBuiltinComponent,
      (componentPrefs) => componentPrefs[alias],
      defaultAnswer
    );
  } else {
    // a basic component
    return resolveBooleanPreference(
      config.canInsertBasics,
      (basicPrefs) => basicPrefs[alias],
      defaultAnswer
    );
  }
}

export function getLeftTabPermission(
  config: UiConfig,
  tab: LeftTabButtonKey,
  opts: {
    isContentCreator: boolean;
  }
) {
  const defaultAnswer = opts.isContentCreator
    ? LEFT_TAB_CONTENT_CREATOR_DEFAULT[tab]
    : "writable";

  if (!config.leftTabs) {
    return defaultAnswer;
  }
  const pref = config.leftTabs[tab];
  return pref ?? defaultAnswer;
}

const LEFT_TAB_CONTENT_CREATOR_DEFAULT: Record<
  LeftTabButtonKey,
  "readable" | "writable" | "hidden"
> = {
  outline: "writable",
  components: "hidden",
  tokens: "hidden",
  mixins: "hidden",
  fonts: "hidden",
  themes: "hidden",
  images: "writable",
  responsiveness: "hidden",
  imports: "hidden",
  versions: "writable",
  settings: "hidden",
  splits: "writable",
  lint: "writable",
  copilot: "hidden",
  figma: "hidden",
};
