// This is a skeleton starter React component generated by Plasmic.
// This file is owned by you, feel free to edit as you see fit.
import { observer } from "mobx-react-lite";
import * as React from "react";
import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { Component, Variant } from "../../../classes";
import { ensure, spawn } from "../../../common";
import { isStyleVariant } from "../../../shared/Variants";
import {
  DefaultVariantSectionProps,
  PlasmicVariantSection,
  PlasmicVariantSection__OverridesType,
} from "../../plasmic/plasmic_kit_variants/PlasmicVariantSection";
import { StudioCtx } from "../../studio-ctx/StudioCtx";
import { ViewCtx } from "../../studio-ctx/view-ctx";
import { useContextMenu } from "../ContextMenu";
import { SelectorTags } from "../sidebar/RuleSetControls";
import { makeVariantMenu } from "./variant-menu";
import VariantRow from "./VariantRow";
import { VariantsController } from "./VariantsController";

interface VariantSectionProps extends DefaultVariantSectionProps {
  menu?: () => React.ReactElement;
  onAddNewVariant?: () => void;
  isDraggable?: boolean;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  emptyAddButtonTooltip?: React.ReactNode;
  onClickSettings?: () => void;
  exprButton?: PlasmicVariantSection__OverridesType["exprButton"];
}

const VariantSection = observer(function VariantSection(
  props: VariantSectionProps
) {
  const {
    menu,
    onAddNewVariant,
    dragHandleProps,
    isDraggable,
    isDragging: _isDragging,
    emptyAddButtonTooltip,
    onClickSettings,
    ...rest
  } = props;

  const contextMenuProps = useContextMenu({ menu });
  const isEmpty = React.Children.count(props.children) === 0;

  const [hover, setHover] = React.useState(false);
  return (
    <PlasmicVariantSection
      header={{
        props: {
          ...contextMenuProps,
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
        },
      }}
      emptyAddButton={
        onAddNewVariant
          ? {
              onClick: onAddNewVariant,
              tooltip: emptyAddButtonTooltip ?? props.emptyAddButtonText,
              "data-test-class": "add-variant-button",
              "data-event": "variantspanel-section-add-variant-to-group",
            }
          : { render: () => null }
      }
      addButton={
        onAddNewVariant
          ? {
              onClick: onAddNewVariant,
              tooltip: isEmpty
                ? emptyAddButtonTooltip ?? props.emptyAddButtonText
                : props.emptyAddButtonText,
              "data-test-class": "add-variant-button",
              "data-event": "variantspanel-section-add-variant-to-group",
            }
          : { render: () => null }
      }
      showSettings={!!onClickSettings}
      settingsButton={{ onClick: onClickSettings }}
      menuButton={{ menu }}
      state={isEmpty ? "empty" : undefined}
      dragHandle={{
        style: {
          display: isDraggable ? (hover ? "flex" : "none") : "none",
        },

        ...dragHandleProps,
      }}
      root={
        {
          "data-test-class": "variants-section",
        } as any
      }
      {...rest}
    />
  );
});

export default VariantSection;

export function makeReadOnlySection(opts: {
  studioCtx: StudioCtx;
  viewCtx?: ViewCtx;
  vcontroller: VariantsController;
  icon: React.ReactNode;
  title: React.ReactNode;
  onClickSettings?: () => void;
  variants: Variant[];
  key: string;
  showIcon?: boolean;
  component?: Component;
}) {
  const {
    variants,
    studioCtx,
    viewCtx,
    vcontroller,
    title,
    icon,
    onClickSettings,
    key,
    showIcon,
    component,
  } = opts;
  const canChangeVariants = vcontroller.canChangeActiveVariants();
  return (
    <VariantSection
      key={key}
      icon={icon}
      title={title}
      showIcon={showIcon}
      onClickSettings={onClickSettings}
    >
      {variants.map((variant) => (
        <VariantRow
          key={variant.uuid}
          variant={variant}
          studioCtx={studioCtx}
          viewCtx={viewCtx}
          pinState={vcontroller.getPinState(variant)}
          menu={
            component
              ? makeVariantMenu({
                  variant,
                  component,
                  onCopyTo: (toVariant) =>
                    spawn(
                      studioCtx.change(({ success }) => {
                        studioCtx
                          .tplMgr()
                          .copyToVariant(component, variant, toVariant);
                        return success();
                      })
                    ),
                })
              : undefined
          }
          onClick={() =>
            studioCtx.changeUnsafe(() => vcontroller.onClickVariant(variant))
          }
          onTarget={
            canChangeVariants || vcontroller.canToggleTargeting(variant)
              ? (target) =>
                  studioCtx.changeUnsafe(() =>
                    vcontroller.onTargetVariant(variant, target)
                  )
              : undefined
          }
          onToggle={
            canChangeVariants
              ? () =>
                  studioCtx.changeUnsafe(() =>
                    vcontroller.onToggleVariant(variant)
                  )
              : undefined
          }
          label={
            isStyleVariant(variant) ? (
              <SelectorTags
                selectors={ensure(
                  variant.selectors,
                  "Style variant is expected to have selectors"
                )}
              />
            ) : (
              variant.name
            )
          }
          isReadOnly
        />
      ))}
    </VariantSection>
  );
}
