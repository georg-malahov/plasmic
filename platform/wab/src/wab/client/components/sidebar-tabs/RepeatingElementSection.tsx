import { Menu } from "antd";
import { observer } from "mobx-react-lite";
import React from "react";
import { ObjectPath, Rep, TplNode } from "../../../classes";
import { ensure } from "../../../common";
import {
  code,
  createExprForDataPickerValue,
  extractValueSavedFromDataPicker,
} from "../../../exprs";
import { mkVar } from "../../../lang";
import { isBaseVariant } from "../../../shared/Variants";
import { tryGetTplOwnerComponent } from "../../../tpls";
import PlusIcon from "../../plasmic/plasmic_kit/PlasmicIcon__Plus";
import { ViewCtx } from "../../studio-ctx/view-ctx";
import { LabeledItemRow } from "../sidebar/sidebar-helpers";
import { SidebarSection } from "../sidebar/SidebarSection";
import { IconLinkButton } from "../widgets";
import { Icon } from "../widgets/Icon";
import { DataPickerEditor } from "./ComponentProps/DataPickerEditor";
import { StringPropEditor } from "./ComponentProps/StringPropEditor";

const defaultElementName = "currentItem";
const defaultIndexName = "currentIndex";

export const RepeatingElementSection = observer(function (props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
}) {
  const { tpl, viewCtx } = props;
  const ownerComponent = tryGetTplOwnerComponent(tpl);
  const [isDataPickerVisible, setIsDataPickerVisible] =
    React.useState<boolean>(false);

  // Although dataRep is in VariantSetting schema, it's not variantable. We
  // just set and use it from the base variant setting (see, for example,
  // serializeDataReps in codegen). Maybe it should be actually be moved out
  // from VariantSetting into TplNode. But while we don't do it, this section
  // just edits the dataRep in baseVs.
  const baseVs = ensure(
    tpl.vsettings.find((vs) => isBaseVariant(vs.variants)),
    "All TplNodes must have a base variant setting"
  );
  const dataRep = baseVs.dataRep;

  const resetDataRep = () => {
    viewCtx.change(() => {
      baseVs.dataRep = new Rep({
        collection: new ObjectPath({
          path: ["[2, 3, 4]"],
          fallback: null,
        }),
        element: mkVar(defaultElementName),
        index: mkVar(defaultIndexName),
      });
    });
  };

  return (
    <SidebarSection
      title="Repeat element"
      isHeaderActive={!!dataRep}
      controls={
        !dataRep && (
          <IconLinkButton
            onClick={resetDataRep}
            data-test-id="btn-repeating-element-add"
          >
            <Icon icon={PlusIcon} />
          </IconLinkButton>
        )
      }
      makeHeaderMenu={
        dataRep
          ? () => (
              <Menu>
                <Menu.Item
                  onClick={() => {
                    viewCtx.change(() => {
                      baseVs.dataRep = null;
                    });
                  }}
                >
                  Remove repetition
                </Menu.Item>
              </Menu>
            )
          : undefined
      }
      data-test-id="repeating-element-section"
    >
      {!!dataRep && (
        <>
          <LabeledItemRow
            label="Collection"
            data-test-id="repeating-element-collection"
          >
            <DataPickerEditor
              viewCtx={viewCtx}
              value={
                extractValueSavedFromDataPicker(dataRep?.collection, {
                  projectFlags: viewCtx.projectFlags(),
                  component: ownerComponent ?? null,
                  inStudio: true,
                }) ?? ""
              }
              onChange={(val) => {
                if (!val) {
                  return;
                }
                const newExpr = createExprForDataPickerValue(val, code(`([])`));
                viewCtx.change(() => {
                  dataRep.collection = newExpr;
                });
              }}
              visible={isDataPickerVisible}
              setVisible={setIsDataPickerVisible}
              data={viewCtx.getCanvasEnvForTpl(tpl, {
                forDataRepCollection: true,
              })}
              schema={viewCtx.customFunctionsSchema()}
              flatten={true}
              key={tpl.uid}
              context="Array of elements to then be iterated"
            />
          </LabeledItemRow>
          <LabeledItemRow
            label="Element name"
            data-test-id="repeating-element-name"
          >
            <StringPropEditor
              disabled={false}
              onChange={(newName) => {
                viewCtx.change(() => {
                  if (newName) {
                    dataRep.element = mkVar(newName);
                  } else {
                    dataRep.element = mkVar(defaultElementName);
                  }
                });
              }}
              value={dataRep.element.name}
              leftAligned
            />
          </LabeledItemRow>
          <LabeledItemRow
            label="Index name"
            data-test-id="repeating-element-index-name"
          >
            <StringPropEditor
              disabled={false}
              onChange={(newName) => {
                viewCtx.change(() => {
                  if (newName) {
                    dataRep.index = mkVar(newName);
                  } else {
                    dataRep.index = null;
                  }
                });
              }}
              value={dataRep.index?.name}
              leftAligned
            />
          </LabeledItemRow>
        </>
      )}
    </SidebarSection>
  );
});
