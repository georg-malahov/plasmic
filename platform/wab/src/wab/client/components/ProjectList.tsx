import React, { useState } from "react";
import { Helmet } from "react-helmet";
import NewProjectModal from "../../../NewProjectModal";
import { mkIdMap } from "../../collections";
import { ensure, filterMapTruthy, spawn } from "../../common";
import { DEVFLAGS } from "../../devflags";
import { ApiPermission, ApiProject, ApiUser } from "../../shared/ApiSchema";
import { getExtraData, updateExtraDataJson } from "../../shared/ApiSchemaUtil";
import { hideStarters } from "../app-ctx";
import { U } from "../cli-routes";
import { useAppCtx } from "../contexts/AppContexts";
import { getUploadedFile } from "../dom-utils";
import { useProjectsFilter } from "../hooks/useProjectsFilter";
import {
  DefaultProjectListProps,
  PlasmicProjectList,
} from "../plasmic/plasmic_kit/PlasmicProjectList";
import ProjectListItem from "./ProjectListItem";
import StarterGroup from "./StarterGroup";
import { Spinner } from "./widgets";

interface ProjectListProps extends DefaultProjectListProps {
  workspaces?: boolean;
}

function ProjectList(props: ProjectListProps) {
  const { workspaces, ...rest } = props;

  const appCtx = useAppCtx();
  const selfInfo = ensure(appCtx.selfInfo, "Unexpected undefined selfInfo");
  const [projectsData, setProjectsData] = React.useState<{
    usersById: Map<string, ApiUser>;
    projects: ApiProject[];
    perms: ApiPermission[];
  }>();

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const updateProjectsData = React.useCallback(async () => {
    const fetchData = async () => {
      const { projects, perms } = await appCtx.api.getProjects();
      const users = filterMapTruthy(perms, (p) => p.user);
      return { usersById: mkIdMap(users), projects, perms };
    };
    await fetchData().then((data) => setProjectsData(data));
  }, [appCtx, selfInfo, setProjectsData]);

  // Fetch data for the first time
  React.useEffect(() => {
    spawn(updateProjectsData());
  }, [updateProjectsData]);

  const allProjects = projectsData?.projects || [];

  const {
    projects,
    matcher,
    props: filterProps,
  } = useProjectsFilter(allProjects, []);

  return projectsData === undefined ? (
    <Spinner />
  ) : (
    <>
      {/* @ts-ignore */}
      <Helmet>
        <link
          href="https://fonts.googleapis.com/css2?family=Bungee&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <PlasmicProjectList
        {...rest}
        mode={DEVFLAGS.demo ? "demo" : undefined}
        newProjectButton={{
          onClick: () => setShowNewProjectModal(true),
        }}
        filter={filterProps}
        mainList={{
          children: projects.map((project) => (
            <ProjectListItem
              key={project.id}
              project={project}
              perms={projectsData.perms}
              onUpdate={updateProjectsData}
              workspaces={workspaces || DEVFLAGS.workspaces}
              matcher={matcher}
              showWorkspace={true}
            />
          )),
        }}
        tutorials={{
          wrap: (node) => {
            if (appCtx.starters.tutorialSections.length === 0) {
              return null;
            }
            if (hideStarters(appCtx)) {
              return null;
            }
            return node;
          },
          props: {
            icon: [],
            defaultCollapsed: getExtraData(selfInfo).collapseStarters,
            onSetCollapsed: async (collapsed) => {
              await appCtx.api.updateSelfInfo(
                updateExtraDataJson(selfInfo, {
                  collapseStarters: collapsed,
                })
              );
            },
            children: appCtx.starters.tutorialSections.map((section) => (
              <StarterGroup
                key={section.tag}
                title={section.title}
                tag={section.tag}
                projects={section.projects}
                infoTooltip={section.infoTooltip}
                docsUrl={section.docsUrl}
                moreUrl={section.moreUrl}
              />
            )),
          },
        }}
        deleted={{
          render: () => null,
        }}
        uploadButton={{
          onClick: () =>
            getUploadedFile(async (data: string) => {
              await appCtx.api.importProject(data).then(({ projectId }) => {
                document.location.href = U.project({
                  projectId: projectId,
                });
              });
            }),
        }}
        noProjects={!projects.length}
        noProjectsText={
          matcher.hasQuery()
            ? "No projects matching query."
            : 'You have no projects. Create a new one by hitting the "New project" button in the top bar.'
        }
      />

      {showNewProjectModal && (
        <NewProjectModal onCancel={() => setShowNewProjectModal(false)} />
      )}
    </>
  );
}

export default ProjectList as React.FunctionComponent<ProjectListProps>;
