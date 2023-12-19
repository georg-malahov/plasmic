import { EditableNodeLabel } from "@/wab/client/components/canvas/EditableNodeLabel";
import { createNodeIcon } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import {
  BASE_VARIANT_COLOR,
  NON_BASE_VARIANT_COLOR,
} from "@/wab/client/components/studio/GlobalCssVariables";
import { frameToScalerRect } from "@/wab/client/coords";
import { hasLayoutBox } from "@/wab/client/dom";
import { computeNodeOutlineTagLayoutClass } from "@/wab/client/node-outline";
import {
  cssPropsForInvertTransform,
  useStudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import { summarizeFocusObj } from "@/wab/client/utils/tpl-client-utils";
import { ensure } from "@/wab/common";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { isTplTagOrComponent, isTplVariantable } from "@/wab/tpls";
import cn from "classnames";
import { observer } from "mobx-react-lite";
import * as React from "react";
import styles from "./HoverBox.module.scss";
import { recomputeBounds } from "./recomputeBounds";

export const PreselectBox = observer(PreselectBox_);
function PreselectBox_() {
  const studioCtx = useStudioCtx();
  const vc = studioCtx.viewCtxs
    // read through all ViewCtx's hovered dom element so that we are
    // subscribed to any hover change.
    .filter((_vc) => !!_vc.$hoveredDomElt())
    .find((_vc) =>
      getArenaFrames(studioCtx.currentArena).includes(_vc.arenaFrame())
    );

  const $hovered = vc?.$hoveredDomElt();
  const $focused = vc === studioCtx.focusedViewCtx() && vc?.focusedDomElt();

  const shouldShow =
    vc &&
    !studioCtx.shouldHidePreselectBox() &&
    $hovered?.length &&
    $hovered?.get(0).isConnected &&
    ($hovered?.toArray().filter(hasLayoutBox) ?? []).length > 0 &&
    (studioCtx.showStackOfParents || !$focused || !$hovered.is($focused));

  const frameRect = shouldShow ? recomputeBounds($hovered!).rect() : undefined;
  const scalerRect =
    frameRect &&
    frameToScalerRect(frameRect, ensure(vc, "ViewCtx is undefined"));
  const cssProps = cssPropsForInvertTransform(studioCtx.zoom, scalerRect);

  const hoveredSelectable = vc?.hoveredSelectable();
  const hoveredTpl = hoveredSelectable?.tpl;
  const isTargetingSomeNonBaseVariant =
    isTplVariantable(hoveredTpl) &&
    vc?.variantTplMgr().isTargetingNonBaseVariant(hoveredTpl);

  const shouldShowHoverTag =
    shouldShow && $hovered !== $focused && hoveredSelectable && hoveredTpl;
  const effectiveVariantSetting =
    shouldShowHoverTag && isTplTagOrComponent(hoveredTpl)
      ? vc!.effectiveCurrentVariantSetting(hoveredTpl)
      : undefined;
  const boxInFrame = shouldShowHoverTag
    ? recomputeBounds($hovered!)
    : undefined;
  const tagName = shouldShowHoverTag
    ? summarizeFocusObj(hoveredSelectable!, vc, effectiveVariantSetting)
    : undefined;
  const tagPosClasses =
    shouldShowHoverTag && boxInFrame
      ? computeNodeOutlineTagLayoutClass(
          vc!.canvasCtx.$doc(),
          boxInFrame.posRect()
        )
      : [];
  const tagIcon =
    shouldShowHoverTag && createNodeIcon(hoveredTpl!, effectiveVariantSetting);

  return (
    <div
      className={cn("PreselectBox", {
        [styles.hoveringParentStack]: studioCtx.showStackOfParents,
      })}
      data-original-width={scalerRect ? scalerRect.width : undefined}
      data-original-height={scalerRect ? scalerRect.height : undefined}
      style={{
        display: shouldShow ? "block" : "none",
        ...(scalerRect ? scalerRect : {}),
        ...cssProps,
        border: "none",
      }}
    >
      <div
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: isTargetingSomeNonBaseVariant
            ? NON_BASE_VARIANT_COLOR
            : BASE_VARIANT_COLOR,
        }}
      />
      {shouldShowHoverTag && (
        <div className={cn(styles.hoverBoxTagContainer, styles.isPreselectBox)}>
          <div className={cn("node-outline-tag", tagPosClasses)}>
            {tagName && (
              <EditableNodeLabel
                studioCtx={studioCtx}
                displayName={tagName}
                icon={tagIcon}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
