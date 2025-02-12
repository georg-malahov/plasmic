// This is a skeleton starter React component generated by Plasmic.
// This file is owned by you, feel free to edit as you see fit.
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";
import { Redirect, Route, Switch } from "react-router";
import { useRRouteMatch, UU } from "../../cli-routes";
import {
  DefaultCmsContentPageProps,
  PlasmicCmsContentPage,
} from "../../plasmic/plasmic_kit_cms/PlasmicCmsContentPage";
import { useCmsDatabase } from "./cms-contexts";

export interface CmsContentPageProps extends DefaultCmsContentPageProps {}

function CmsContentPage_(
  props: CmsContentPageProps,
  ref: HTMLElementRefOf<"div">
) {
  const m = useRRouteMatch(UU.cmsContentRoot);
  const database = useCmsDatabase(m?.params.databaseId);
  if (!m || !database) {
    return null;
  }

  return (
    <Switch>
      <Route
        path={UU.cmsModelContent.pattern}
        render={({ match }) => {
          if (
            database &&
            !database?.tables.find((t) => t.id === match.params.tableId)
          ) {
            return (
              <Redirect
                to={UU.cmsContentRoot.fill({
                  databaseId: match.params.databaseId,
                })}
              />
            );
          } else {
            return <PlasmicCmsContentPage root={{ ref }} {...props} />;
          }
        }}
      />
      <Route
        path={UU.cmsContentRoot.pattern}
        render={() => {
          if (database && database.tables.length > 0) {
            return (
              <Redirect
                to={UU.cmsModelContent.fill({
                  databaseId: database.id,
                  tableId: database.tables[0].id,
                })}
              />
            );
          } else {
            return (
              <PlasmicCmsContentPage
                noModels={true}
                root={{ ref }}
                {...props}
              />
            );
          }
        }}
      />
    </Switch>
  );
}

const CmsContentPage = React.forwardRef(CmsContentPage_);
export default CmsContentPage;
