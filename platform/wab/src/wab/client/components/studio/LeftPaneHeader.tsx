// This is a skeleton starter React component generated by Plasmic.
// Feel free to edit as you see fit.
import React, { ReactNode } from "react";
import { PlasmicLeftPaneHeader } from "../../plasmic/plasmic_kit/PlasmicLeftPaneHeader";

interface LeftPaneHeaderProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compactTitle?: ReactNode;
  titleActions?: ReactNode;
  // className prop is required for positioning instances of
  // this Component
  className?: string;
  children?: never;
  alert?: ReactNode;
  isExpanded?: boolean;
  onExpandClick?: () => void;
  compact?: boolean;
  hasTitleActions?: boolean;
  noActions?: boolean;
  noDescription?: boolean;
}

function LeftPaneHeader(props: LeftPaneHeaderProps) {
  return (
    <PlasmicLeftPaneHeader
      variants={{
        noActions: props.noActions || React.Children.count(props.actions) === 0,
        showAlert: props.alert !== undefined,
        noDescription: props.noDescription,
      }}
      args={{
        title: props.title,
        description: props.description,
        actions: props.actions,
        alert: props.alert,
        compactTitle: props.compactTitle,
        titleActions: props.titleActions,
      }}
      hasTitleActions={props.hasTitleActions}
      expandState={
        props.isExpanded == undefined
          ? undefined
          : props.isExpanded
          ? "expanded"
          : "collapsed"
      }
      expandButton={{
        onClick: props.onExpandClick,
      }}
      expandButton2={{
        onClick: props.onExpandClick,
      }}
      compact={props.compact}
      header={
        // className prop needs to be piped to the root element of this component
        { className: props.className }
      }
    />
  );
}

export default LeftPaneHeader as React.FunctionComponent<LeftPaneHeaderProps>;
