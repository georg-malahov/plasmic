import React from "react";
import { ValueSetState } from "../../sidebar/sidebar-helpers";
import StyleSwitch from "../../style-controls/StyleSwitch";

export function BoolPropEditor(props: {
  onChange: (value: boolean) => void;
  value: boolean | undefined;
  defaultValueHint?: boolean;
  valueSetState?: ValueSetState;
  disabled?: boolean;
  "data-plasmic-prop"?: string;
}) {
  return (
    <div className="flex justify-start">
      <StyleSwitch
        isChecked={props.value ?? props.defaultValueHint ?? false}
        onChange={(checked) => props.onChange(checked)}
        valueSetState={props.valueSetState}
        isDisabled={props.disabled}
        data-plasmic-prop={props["data-plasmic-prop"]}
      >
        {null}
      </StyleSwitch>
    </div>
  );
}
