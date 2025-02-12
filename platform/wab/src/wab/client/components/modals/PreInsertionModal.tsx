import React from "react";
import { createRoot } from "react-dom/client";
import { Modal } from "src/wab/client/components/widgets/Modal";
import { Component, Expr } from "../../../classes";
import { hackyCast } from "../../../common";
import { tryExtractJson } from "../../../exprs";
import {
  isPlainObjectPropType,
  maybePropTypeToDisplayName,
  StudioPropType,
} from "../../../shared/code-components/code-components";
import { providesStudioCtx, StudioCtx } from "../../studio-ctx/StudioCtx";
import { InnerPropEditorRow } from "../sidebar-tabs/PropEditorRow";

export async function getPreInsertionProps(
  studioCtx: StudioCtx,
  component: Component
): Promise<Record<string, Expr> | undefined> {
  return new Promise((resolve) => {
    const handleModalClose = (data: Record<string, Expr> | undefined) => {
      root.unmount();
      modalElement.parentNode?.removeChild(modalElement);

      resolve(data);
    };

    const modalElement = document.createElement("div");
    const root = createRoot(modalElement);
    root.render(
      <PreInsertionModal
        onClose={handleModalClose}
        studioCtx={studioCtx}
        component={component}
      />
    );
  });
}

interface PreInsertionModalProps {
  onClose: (data: any) => void;
  studioCtx: StudioCtx;
  component: Component;
}

export const PreInsertionModal = (props: PreInsertionModalProps) => {
  const { studioCtx, component } = props;
  const [isOpen, setIsOpen] = React.useState(true);
  const [args, setArgs] = React.useState<Record<string, Expr>>({});

  const meta = React.useMemo(
    () => studioCtx.getCodeComponentMeta(component),
    [component]
  );

  const onClose = React.useCallback(
    (data: Record<string, Expr> | undefined) => {
      setIsOpen(false);
      props.onClose(data);
    },
    [setIsOpen, props.onClose]
  );

  return (
    <Modal
      open={isOpen}
      closeIcon={<></>}
      onCancel={() => onClose(undefined)}
      onOk={() => onClose(args)}
    >
      {providesStudioCtx(studioCtx)(
        <div style={{ backgroundColor: "white" }}>
          {Object.entries(hackyCast(meta).preInsertion).map(([name, prop]) => {
            const propType = prop as StudioPropType<any>;
            const litArgs = Object.fromEntries(
              Object.entries(args).map(([arg, expr]) => [
                arg,
                tryExtractJson(expr),
              ])
            );
            // TODO: we don't allow dynamic values in the pre-insertion stage
            if (
              isPlainObjectPropType(propType) &&
              "hidden" in propType &&
              propType.hidden?.(litArgs, {}, { path: [] })
            ) {
              return null;
            }
            return (
              <InnerPropEditorRow
                attr={name}
                propType={propType as StudioPropType<any>}
                expr={args[name]}
                label={
                  maybePropTypeToDisplayName(propType as StudioPropType<any>) ??
                  name
                }
                onChange={(newExpr) => {
                  if (newExpr) {
                    setArgs((oldArgs) => ({
                      ...oldArgs,
                      [name]: newExpr,
                    }));
                  } else {
                    setArgs((oldArgs) => {
                      const newArgs = { ...oldArgs };
                      delete newArgs[name];
                      return newArgs;
                    });
                  }
                }}
                disableDynamicValue={true}
              />
            );
          })}
        </div>
      )}
    </Modal>
  );
};
