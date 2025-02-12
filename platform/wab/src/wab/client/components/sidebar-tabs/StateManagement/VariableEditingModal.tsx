import startCase from "lodash/startCase";
import React from "react";
import { Component, State } from "../../../../classes";
import { spawn } from "../../../../common";
import { VARIABLE_CAP } from "../../../../shared/Labels";
import { StudioCtx } from "../../../studio-ctx/StudioCtx";
import { SidebarModal } from "../../sidebar/SidebarModal";
import VariableEditingForm from "./VariableEditingForm";

export function VariableEditingModal({
  component,
  onClose,
  show,
  studioCtx,
  state,
  mode = "edit",
}: {
  state?: State | null;
  show: boolean;
  onClose: () => any;
  studioCtx: StudioCtx;
  component: Component;
  mode?: "new" | "edit";
}) {
  const preventCancellingRef = React.useRef(false);

  React.useEffect(() => {
    preventCancellingRef.current = false;
  }, [state]);

  const onCancel = () => {
    if (!state || preventCancellingRef.current) {
      return;
    }

    spawn(
      studioCtx
        .change(({ success }) => {
          try {
            studioCtx.siteOps().removeState(component, state);
          } catch {
            // Not a problem if the state was already removed
          }
          return success();
        })
        .then(() => {
          onClose();
        })
    );
  };

  return (
    <SidebarModal
      title={startCase(`${mode} ${VARIABLE_CAP}`)}
      show={show}
      // For mode === "new", we block the modal from auto-closing (via
      // persitOnInteractOutside), and we handle the closing explicitly
      // via onCancel
      onClose={mode === "edit" ? onClose : undefined}
      // If creating a new variable, it is only created upon clicking
      // the confirm button, so we don't allow you to dismiss the
      // modal so easily
      persistOnInteractOutside={mode === "new"}
    >
      {state && (
        <VariableEditingForm
          state={state}
          studioCtx={studioCtx}
          component={component}
          mode={mode}
          onConfirm={() => {
            preventCancellingRef.current = true;
            onClose();
          }}
          onCancel={onCancel}
        />
      )}
    </SidebarModal>
  );
}
