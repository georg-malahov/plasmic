// @ts-nocheck
/* eslint-disable */
/* tslint:disable */
/* prettier-ignore-start */

/** @jsxRuntime classic */
/** @jsx createPlasmicElementProxy */
/** @jsxFrag React.Fragment */

// This class is auto-generated by Plasmic; please do not edit!
// Plasmic Project: ieacQ3Z46z4gwo1FnaB5vY
// Component: 9vM3ZFGR4eV

import * as React from "react";

import * as p from "@plasmicapp/react-web";
import * as ph from "@plasmicapp/react-web/lib/host";

import {
  hasVariant,
  classNames,
  wrapWithClassName,
  createPlasmicElementProxy,
  makeFragment,
  MultiChoiceArg,
  SingleBooleanChoiceArg,
  SingleChoiceArg,
  pick,
  omit,
  useTrigger,
  StrictProps,
  deriveRenderOpts,
  ensureGlobalVariants,
} from "@plasmicapp/react-web";
import InlineEditable from "../../../../InlineEditable"; // plasmic-import: btpz7A3thO/component
import Button from "../../components/widgets/Button"; // plasmic-import: SEF-sRmSoqV5c/component
import MenuButton from "../../components/widgets/MenuButton"; // plasmic-import: h69wHrrKtL/component

import "@plasmicapp/react-web/lib/plasmic.css";

import plasmic_plasmic_kit_design_system_css from "../PP__plasmickit_design_system.module.css"; // plasmic-import: tXkSR39sgCDWSitZxC5xFV/projectcss
import plasmic_plasmic_kit_color_tokens_css from "../plasmic_kit_q_4_color_tokens/plasmic_plasmic_kit_q_4_color_tokens.module.css"; // plasmic-import: 95xp9cYcv7HrNWpFWWhbcv/projectcss
import projectcss from "./plasmic_plasmic_kit_cms.module.css"; // plasmic-import: ieacQ3Z46z4gwo1FnaB5vY/projectcss
import sty from "./PlasmicCmsEntryDetails.module.css"; // plasmic-import: 9vM3ZFGR4eV/css

import EditsvgIcon from "../q_4_icons/icons/PlasmicIcon__Editsvg"; // plasmic-import: _Qa2gdunG/icon
import HistoryIcon from "../plasmic_kit/PlasmicIcon__History"; // plasmic-import: 6ZOswzsUR/icon
import ChevronDownsvgIcon from "../q_4_icons/icons/PlasmicIcon__ChevronDownsvg"; // plasmic-import: xZrB9_0ir/icon
import ArrowRightsvgIcon from "../q_4_icons/icons/PlasmicIcon__ArrowRightsvg"; // plasmic-import: 9Jv8jb253/icon

createPlasmicElementProxy;

export type PlasmicCmsEntryDetails__VariantMembers = {};
export type PlasmicCmsEntryDetails__VariantsArgs = {};
type VariantPropType = keyof PlasmicCmsEntryDetails__VariantsArgs;
export const PlasmicCmsEntryDetails__VariantProps =
  new Array<VariantPropType>();

export type PlasmicCmsEntryDetails__ArgsType = {
  children?: React.ReactNode;
};
type ArgPropType = keyof PlasmicCmsEntryDetails__ArgsType;
export const PlasmicCmsEntryDetails__ArgProps = new Array<ArgPropType>(
  "children"
);

export type PlasmicCmsEntryDetails__OverridesType = {
  root?: p.Flex<"div">;
  left?: p.Flex<"div">;
  entryName?: p.Flex<typeof InlineEditable>;
  entryNameValue?: p.Flex<"div">;
  saveStatus?: p.Flex<"div">;
  right?: p.Flex<"div">;
  historyButton?: p.Flex<typeof Button>;
  svg?: p.Flex<"svg">;
  text?: p.Flex<"div">;
  publishButton?: p.Flex<typeof Button>;
  menuButton?: p.Flex<typeof MenuButton>;
};

export interface DefaultCmsEntryDetailsProps {
  children?: React.ReactNode;
  className?: string;
}

function PlasmicCmsEntryDetails__RenderFunc(props: {
  variants: PlasmicCmsEntryDetails__VariantsArgs;
  args: PlasmicCmsEntryDetails__ArgsType;
  overrides: PlasmicCmsEntryDetails__OverridesType;
  forNode?: string;
}) {
  const { variants, overrides, forNode } = props;

  const args = React.useMemo(() => Object.assign({}, props.args), [props.args]);

  const $props = {
    ...args,
    ...variants,
  };

  const $ctx = ph.useDataEnv?.() || {};
  const refsRef = React.useRef({});
  const $refs = refsRef.current;

  const currentUser = p.useCurrentUser?.() || {};

  return (
    <div
      data-plasmic-name={"root"}
      data-plasmic-override={overrides.root}
      data-plasmic-root={true}
      data-plasmic-for-node={forNode}
      className={classNames(
        projectcss.all,
        projectcss.root_reset,
        projectcss.plasmic_default_styles,
        projectcss.plasmic_mixins,
        projectcss.plasmic_tokens,
        plasmic_plasmic_kit_design_system_css.plasmic_tokens,
        plasmic_plasmic_kit_color_tokens_css.plasmic_tokens,
        sty.root
      )}
    >
      <div className={classNames(projectcss.all, sty.freeBox__yjd67)}>
        <div
          data-plasmic-name={"left"}
          data-plasmic-override={overrides.left}
          className={classNames(projectcss.all, sty.left)}
        >
          <InlineEditable
            data-plasmic-name={"entryName"}
            data-plasmic-override={overrides.entryName}
            className={classNames("__wab_instance", sty.entryName)}
            placeholder={""}
          >
            <div
              data-plasmic-name={"entryNameValue"}
              data-plasmic-override={overrides.entryNameValue}
              className={classNames(
                projectcss.all,
                projectcss.__wab_text,
                sty.entryNameValue
              )}
            >
              {"Enter some text"}
            </div>
          </InlineEditable>
          <div
            data-plasmic-name={"saveStatus"}
            data-plasmic-override={overrides.saveStatus}
            className={classNames(
              projectcss.all,
              projectcss.__wab_text,
              sty.saveStatus
            )}
          >
            {"Auto-saved"}
          </div>
        </div>
        <p.Stack
          as={"div"}
          data-plasmic-name={"right"}
          data-plasmic-override={overrides.right}
          hasGap={true}
          className={classNames(projectcss.all, sty.right)}
        >
          <Button
            data-plasmic-name={"historyButton"}
            data-plasmic-override={overrides.historyButton}
            className={classNames("__wab_instance", sty.historyButton)}
            size={"wide"}
            startIcon={
              <HistoryIcon
                data-plasmic-name={"svg"}
                data-plasmic-override={overrides.svg}
                className={classNames(projectcss.all, sty.svg)}
                role={"img"}
              />
            }
            type={["clear"]}
            withIcons={["startIcon"]}
          >
            <div
              data-plasmic-name={"text"}
              data-plasmic-override={overrides.text}
              className={classNames(
                projectcss.all,
                projectcss.__wab_text,
                sty.text
              )}
            >
              {"History"}
            </div>
          </Button>
          <Button
            data-plasmic-name={"publishButton"}
            data-plasmic-override={overrides.publishButton}
            className={classNames("__wab_instance", sty.publishButton)}
            size={"wide"}
            type={["primary"]}
          >
            {"Publish"}
          </Button>
          <MenuButton
            data-plasmic-name={"menuButton"}
            data-plasmic-override={overrides.menuButton}
            className={classNames("__wab_instance", sty.menuButton)}
          />
        </p.Stack>
      </div>
      <div className={classNames(projectcss.all, sty.freeBox__rFHa)}>
        <div className={classNames(projectcss.all, sty.freeBox___1VH9Z)}>
          {p.renderPlasmicSlot({
            defaultContents: null,
            value: args.children,
          })}
        </div>
      </div>
    </div>
  ) as React.ReactElement | null;
}

const PlasmicDescendants = {
  root: [
    "root",
    "left",
    "entryName",
    "entryNameValue",
    "saveStatus",
    "right",
    "historyButton",
    "svg",
    "text",
    "publishButton",
    "menuButton",
  ],
  left: ["left", "entryName", "entryNameValue", "saveStatus"],
  entryName: ["entryName", "entryNameValue"],
  entryNameValue: ["entryNameValue"],
  saveStatus: ["saveStatus"],
  right: [
    "right",
    "historyButton",
    "svg",
    "text",
    "publishButton",
    "menuButton",
  ],
  historyButton: ["historyButton", "svg", "text"],
  svg: ["svg"],
  text: ["text"],
  publishButton: ["publishButton"],
  menuButton: ["menuButton"],
} as const;
type NodeNameType = keyof typeof PlasmicDescendants;
type DescendantsType<T extends NodeNameType> =
  (typeof PlasmicDescendants)[T][number];
type NodeDefaultElementType = {
  root: "div";
  left: "div";
  entryName: typeof InlineEditable;
  entryNameValue: "div";
  saveStatus: "div";
  right: "div";
  historyButton: typeof Button;
  svg: "svg";
  text: "div";
  publishButton: typeof Button;
  menuButton: typeof MenuButton;
};

type ReservedPropsType = "variants" | "args" | "overrides";
type NodeOverridesType<T extends NodeNameType> = Pick<
  PlasmicCmsEntryDetails__OverridesType,
  DescendantsType<T>
>;
type NodeComponentProps<T extends NodeNameType> =
  // Explicitly specify variants, args, and overrides as objects
  {
    variants?: PlasmicCmsEntryDetails__VariantsArgs;
    args?: PlasmicCmsEntryDetails__ArgsType;
    overrides?: NodeOverridesType<T>;
  } & Omit<PlasmicCmsEntryDetails__VariantsArgs, ReservedPropsType> & // Specify variants directly as props
    /* Specify args directly as props*/ Omit<
      PlasmicCmsEntryDetails__ArgsType,
      ReservedPropsType
    > &
    /* Specify overrides for each element directly as props*/ Omit<
      NodeOverridesType<T>,
      ReservedPropsType | VariantPropType | ArgPropType
    > &
    /* Specify props for the root element*/ Omit<
      Partial<React.ComponentProps<NodeDefaultElementType[T]>>,
      ReservedPropsType | VariantPropType | ArgPropType | DescendantsType<T>
    >;

function makeNodeComponent<NodeName extends NodeNameType>(nodeName: NodeName) {
  type PropsType = NodeComponentProps<NodeName> & { key?: React.Key };
  const func = function <T extends PropsType>(
    props: T & StrictProps<T, PropsType>
  ) {
    const { variants, args, overrides } = React.useMemo(
      () =>
        deriveRenderOpts(props, {
          name: nodeName,
          descendantNames: [...PlasmicDescendants[nodeName]],
          internalArgPropNames: PlasmicCmsEntryDetails__ArgProps,
          internalVariantPropNames: PlasmicCmsEntryDetails__VariantProps,
        }),
      [props, nodeName]
    );
    return PlasmicCmsEntryDetails__RenderFunc({
      variants,
      args,
      overrides,
      forNode: nodeName,
    });
  };
  if (nodeName === "root") {
    func.displayName = "PlasmicCmsEntryDetails";
  } else {
    func.displayName = `PlasmicCmsEntryDetails.${nodeName}`;
  }
  return func;
}

export const PlasmicCmsEntryDetails = Object.assign(
  // Top-level PlasmicCmsEntryDetails renders the root element
  makeNodeComponent("root"),
  {
    // Helper components rendering sub-elements
    left: makeNodeComponent("left"),
    entryName: makeNodeComponent("entryName"),
    entryNameValue: makeNodeComponent("entryNameValue"),
    saveStatus: makeNodeComponent("saveStatus"),
    right: makeNodeComponent("right"),
    historyButton: makeNodeComponent("historyButton"),
    svg: makeNodeComponent("svg"),
    text: makeNodeComponent("text"),
    publishButton: makeNodeComponent("publishButton"),
    menuButton: makeNodeComponent("menuButton"),

    // Metadata about props expected for PlasmicCmsEntryDetails
    internalVariantProps: PlasmicCmsEntryDetails__VariantProps,
    internalArgProps: PlasmicCmsEntryDetails__ArgProps,
  }
);

export default PlasmicCmsEntryDetails;
/* prettier-ignore-end */
