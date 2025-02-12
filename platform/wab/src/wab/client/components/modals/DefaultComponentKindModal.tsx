import { Form, Select } from "antd";
import React from "react";
import { Modal } from "src/wab/client/components/widgets/Modal";
import { defaultComponentKinds } from "../../../components";
import { StudioCtx } from "../../studio-ctx/StudioCtx";
import Button from "../widgets/Button";

export function DefaultComponentKindModal<T>({
  studioCtx,
  onSubmit,
  onCancel,
}: {
  studioCtx: StudioCtx;
  onSubmit: (val: T) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={<h3>Set as default component</h3>}
      visible
      footer={null}
      onCancel={() => onCancel()}
    >
      <Form
        labelCol={{
          span: 3,
        }}
        onFinish={(values) => {
          onSubmit(values.kind);
        }}
      >
        <Form.Item
          name="kind"
          label="Kind"
          rules={[
            {
              required: true,
            },
          ]}
        >
          <Select placeholder="Set as the default component for this category">
            {Object.entries(defaultComponentKinds).map(([kind, label]) => (
              <Select.Option value={kind}>{label}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          wrapperCol={{
            xs: {
              span: 24,
            },
            sm: {
              span: 8,
              offset: 8,
            },
          }}
        >
          <Button htmlType={"submit"} size={"stretch"} type={"primary"}>
            Submit
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
