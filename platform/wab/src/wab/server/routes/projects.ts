import {
  Component,
  ensureKnownProjectDependency,
  ensureKnownSite,
  ProjectDependency,
  Site,
} from "@/wab/classes";
import { modelSchemaHash } from "@/wab/classes-metas";
import { getSandbox, shareSandbox } from "@/wab/codesandbox/api";
import {
  createNewSandbox,
  getCodesandboxOpts,
  getVersionTxt,
  updateSandbox,
} from "@/wab/codesandbox/utils";
import { Dict, mkIdMap } from "@/wab/collections";
import {
  assert,
  ensure,
  ensureType,
  maybe,
  maybes,
  mkShortId,
  mkUuid,
  strictFind,
  uncheckedCast,
  withoutNils,
  xGroupBy,
} from "@/wab/common";
import * as semver from "@/wab/commons/semver";
import { addOrUpsertTokens } from "@/wab/commons/StyleToken";
import { brand, RequiredSubKeys } from "@/wab/commons/types";
import { ProjectVersionMeta, VersionResolution } from "@/wab/commons/versions";
import { ComponentType, isPlasmicComponent } from "@/wab/components";
import { DEVFLAGS } from "@/wab/devflags";
import { syncGlobalContexts } from "@/wab/project-deps";
import { reevaluateDataSourceExprOpIds } from "@/wab/server/data-sources/data-source-utils";
import { unbundleSite } from "@/wab/server/db/bundle-migration-utils";
import {
  getLastBundleVersion,
  getMigratedBundle,
  getMigrationsToExecute,
} from "@/wab/server/db/BundleMigrator";
import {
  loadDepPackages,
  unbundlePkgVersion,
} from "@/wab/server/db/DbBundleLoader";
import {
  DbMgr,
  ProjectRevisionError,
  ProofSafeDelete,
  SUPER_USER,
} from "@/wab/server/db/DbMgr";
import { onProjectDelete } from "@/wab/server/db/op-hooks";
import { upgradeReferencedHostlessDeps } from "@/wab/server/db/upgrade-hostless-utils";
import {
  sendInviteApprovalAdminEmail,
  sendShareEmail,
} from "@/wab/server/emails/Emails";
import {
  Branch,
  PkgVersion,
  Project,
  ProjectRevision,
} from "@/wab/server/entities/Entities";
import "@/wab/server/extensions";
import { getCodesandboxToken } from "@/wab/server/secrets";
import { broadcastProjectsMessage } from "@/wab/server/socket-util";
import { TutorialType } from "@/wab/server/tutorialdb/tutorialdb-utils";
import { withSpan } from "@/wab/server/util/apm-util";
import { generateSomeApiToken } from "@/wab/server/util/Tokens";
import {
  BadRequestError,
  BundleTypeError,
  NotFoundError,
  SchemaMismatchError,
  StaleCliError,
  UnknownReferencesError,
} from "@/wab/shared/ApiErrors/errors";
import {
  AddCommentReactionRequest,
  ApiNotificationSettings,
  ApiProject,
  BranchId,
  CloneProjectRequest,
  CreateBranchRequest,
  CreateBranchResponse,
  CreateSiteRequest,
  DataSourceId,
  GetCommentsResponse,
  GrantRevokeRequest,
  GrantRevokeResponse,
  ListBranchesResponse,
  MainBranchId,
  NewComponentReq,
  PkgVersionId,
  PostCommentRequest,
  PostCommentResponse,
  ProjectFullDataResponse,
  ProjectId,
  ProjectRevWithoutDataResponse,
  ProjectsRequest,
  ProjectsResponse,
  PublishProjectRequest,
  ResolveSyncRequest,
  TryMergeRequest,
  TryMergeResponse,
  UpdateBranchRequest,
  UpdateHostUrlRequest,
  UpdateHostUrlResponse,
  UpdateProjectReq,
  UpdateProjectResponse,
} from "@/wab/shared/ApiSchema";
import { fullName, parseProjectBranchId } from "@/wab/shared/ApiSchemaUtil";
import {
  Bundler,
  checkBundleFields,
  checkExistingReferences,
  checkRefsInBundle,
  getAllXRefs,
  removeUnreachableNodesFromBundle,
} from "@/wab/shared/bundler";
import {
  Bundle,
  getBundle,
  isExpectedBundleVersion,
  OutdatedBundleError,
} from "@/wab/shared/bundles";
import { componentToDeepReferenced } from "@/wab/shared/cached-selectors";
import { elementSchemaToTpl } from "@/wab/shared/code-components/code-components";
import {
  exportIconAsset,
  extractUsedIconAssetsForComponents,
} from "@/wab/shared/codegen/image-assets";
import { exportStyleConfig } from "@/wab/shared/codegen/react-p";
import { exportStyleTokens } from "@/wab/shared/codegen/style-tokens";
import { ExportOpts } from "@/wab/shared/codegen/types";
import { toClassName } from "@/wab/shared/codegen/util";
import { CodeSandboxInfo } from "@/wab/shared/db-json-blobs";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { DomainValidator } from "@/wab/shared/hosting";
import { createTaggedResourceId } from "@/wab/shared/perms";
import { requiredPackageVersions } from "@/wab/shared/required-versions";
import { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mergeUiConfigs } from "@/wab/shared/ui-config-utils";
import {
  createSite,
  getAllOpExprSourceIdsUsedInSite,
  localComponents,
  localIcons,
} from "@/wab/sites";
import { createProjectUrl, getCodegenUrl } from "@/wab/urls";
import * as Sentry from "@sentry/node";
import { ISandbox } from "codesandbox-import-util-types";
import { Request, Response } from "express-serve-static-core";
import * as _ from "lodash";
import L, { isString, last, uniq, without } from "lodash";
import fetch from "node-fetch";
import * as Prettier from "prettier";
import { EntityManager, getConnection, MigrationExecutor } from "typeorm";
import { escapeHTML } from "underscore.string";
import { mkApiDataSource } from "./data-source";
import { moveBundleAssetsToS3 } from "./moveAssetsToS3";
import { maybeTriggerPaywall, passPaywall } from "./team-plans";
import {
  getUser,
  hasUser,
  parseMetadata,
  parseQueryParams,
  superDbMgr,
  userAnalytics,
  userDbMgr,
} from "./util";

export function mkApiProject(project: Project): ApiProject {
  return {
    ...L.omit(project, "workspace"),
    workspaceName: project.workspace?.name || null,
    teamId: project.workspace?.teamId || null,
    teamName: project.workspace?.team?.name || null,
    featureTier: project.workspace?.team?.featureTier || null,
    uiConfig: mergeUiConfigs(
      project.workspace?.team?.parentTeam?.uiConfig,
      project.workspace?.team?.uiConfig,
      project.workspace?.uiConfig
    ),
    contentCreatorConfig: project.workspace?.team?.featureTier
      ?.editContentCreatorMode
      ? project.workspace?.contentCreatorConfig
      : null,
  };
}

export async function listProjects(req: Request, res: Response) {
  const mgr = userDbMgr(req);

  const data = parseQueryParams(req) as ProjectsRequest;

  const projects =
    data.query === "byIds"
      ? await mgr.getProjectsById(data.projectIds)
      : data.query === "byWorkspace"
      ? await mgr.getProjectsByWorkspaces([data.workspaceId])
      : await mgr.listProjectsForSelf();

  const privateProjsIds = projects
    .filter((project) => !project.readableByPublic)
    .map((project) => project.id);
  const publicProjsIds = projects
    .filter((project) => project.readableByPublic)
    .map((project) => project.id);
  const perms = (await mgr.getPermissionsForProjects(privateProjsIds)).concat(
    (await mgr.getPermissionsForProjects(publicProjsIds)).filter((perm) => {
      return accessLevelRank(perm.accessLevel) >= accessLevelRank("content");
    })
  );

  res.json(
    ensureType<ProjectsResponse>({
      projects: projects.map((p) => mkApiProject(p)),
      perms,
    })
  );
}

export async function createProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { bundler } = req;

  const { name, workspaceId }: CreateSiteRequest = req.body;

  const site = createSite();

  const { project, rev } = await mgr.createProjectAndSaveRev({
    site,
    bundler,
    name: name ?? "Untitled Project",
    workspaceId,
  });
  userAnalytics(req).track({
    event: "Create project",
    properties: {
      projectId: project.id,
    },
  });
  req.promLabels.projectId = project.id;
  res.json({ project: mkApiProject(project), rev: _.omit(rev, "data") });
}

export async function createProjectWithHostlessPackages(
  req: Request,
  res: Response
) {
  const mgr = userDbMgr(req);
  const { bundler } = req;

  const site = createSite();
  const { hostLessPackagesInfo } = req.body;
  for (const hostLessPackageInfo of hostLessPackagesInfo) {
    const projectDependency = await mgr.createHostLessProject(
      hostLessPackageInfo,
      bundler
    );
    site.projectDependencies.push(projectDependency);

    syncGlobalContexts(projectDependency, site);
  }

  const { project, rev } = await mgr.createProjectAndSaveRev({
    site,
    bundler,
    name: "Untitled Project",
  });

  req.promLabels.projectId = project.id;
  res.json({ project: mkApiProject(project), rev: _.omit(rev, "data") });
}

export async function cloneProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { projectId } = req.params;
  const { name, workspaceId, branchName }: CloneProjectRequest = req.body;
  const project = await mgr.cloneProject(projectId as ProjectId, req.bundler, {
    name,
    workspaceId,
    branchName,
  });
  req.promLabels.projectId = projectId;
  res.json({ projectId: project.id, workspaceId: project.workspaceId });
}

export async function clonePublishedTemplate(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { projectId } = req.params;
  const pkg = await mgr.getPkgByProjectId(projectId);
  if (!pkg) {
    throw new NotFoundError(`Unknown template project id ${projectId}`);
  }
  const { name, workspaceId, hostUrl }: CloneProjectRequest = req.body;
  const project = await mgr.clonePublishedTemplate(projectId, req.bundler, {
    name,
    workspaceId,
    hostUrl,
  });
  userAnalytics(req).track({
    event: "Clone template",
    properties: {
      projectId: project.id,
      projectName: project.name,
    },
  });
  req.promLabels.projectId = projectId;
  res.json({ projectId: project.id, token: project.projectApiToken });
}

type DataSourceReplacement =
  | {
      type: string;
    }
  | {
      fakeSourceId: string;
    };

export async function importProject(req: Request, res: Response) {
  const {
    name,
    data,
    publish,
    prefilled,
    keepProjectIdsAndNames,
    updateImportedHostLess,
    dataSourceReplacement,
    migrationsStrict,
    projectDomains,
  } = req.body as {
    data: string;
    name?: string;
    publish?: boolean;
    prefilled?: boolean;
    keepProjectIdsAndNames?: boolean; // keepProjectIdsAndNames shouldn't be used together with publish
    migrationsStrict?: boolean; // Used for tests only
    updateImportedHostLess?: boolean;
    dataSourceReplacement?: DataSourceReplacement;
    projectDomains?: string[];
  };

  const bundles = JSON.parse(data) as
    | [string, Bundle][]
    | ProjectFullDataResponse;
  const mgr = userDbMgr(req);

  if (!Array.isArray(bundles)) {
    const project = await importFullProjectData(bundles, mgr, req.bundler);
    res.json({
      projectId: project.id,
      projectApiToken: project.projectApiToken,
    });
    return;
  }

  const bundler = req.bundler;

  const project = await doImportProject(bundles, mgr, bundler, {
    projectName: name,
    keepProjectIdsAndNames,
    dataSourceReplacement,
    migrationsStrict,
  });
  req.promLabels.projectId = project.id;

  if (name) {
    await mgr.updateProject({ id: project.id, name });
  }

  if (updateImportedHostLess) {
    await upgradeReferencedHostlessDeps(mgr, project.id);
  }

  if (projectDomains && projectDomains.length > 0) {
    await mgr.setDomainsForProject(projectDomains, project.id);
  }

  if (publish) {
    const { pkgVersion } = await mgr.publishProject(
      project.id,
      "1.0.0",
      [],
      ""
    );
    if (prefilled) {
      await mgr.updatePkgVersion(
        pkgVersion.pkgId,
        pkgVersion.version,
        pkgVersion.branchId,
        {
          isPrefilled: true,
        }
      );
    }
  }

  res.json({
    projectId: project.id,
    projectApiToken: project.projectApiToken,
    workspaceId: project.workspaceId,
  });
}

export async function doImportProject(
  bundles: [string, Bundle][],
  mgr: DbMgr,
  bundler: Bundler,
  opts?: {
    keepProjectIdsAndNames?: boolean;
    projectName?: string;
    migrationsStrict?: boolean;
    dataSourceReplacement?: DataSourceReplacement;
  }
): Promise<Project> {
  const depBundles = bundles.slice(0, bundles.length - 1);
  const [_oldProjectId, siteBundle] = ensure(
    last(bundles),
    "Couldn't find last bundle"
  );
  const oldToNewUuid = new Map<string, string>();
  const newPkgVersionById = new Map<string, PkgVersion>();

  const migrateBundle = async (bundle: Bundle) => {
    const migrations = await getMigrationsToExecute(bundle.version);
    for (const migration of migrations) {
      const entity = { id: "id" } as PkgVersion | ProjectRevision;
      const db = {
        getPkgVersionById: (id: string) => {
          const res = newPkgVersionById.get(id);
          if (!res) {
            throw new Error("Unknown id " + id);
          }
          return {
            id,
            model: res.model,
          };
        },
        tryGetDevFlagOverrides: () => undefined,
        // Allowed during import only after saving the bundle
        allowProjectToDataSources: () => undefined,
      } as any;
      await migration.migrate(bundle, db, entity);
      bundle.version = migration.name;
      if (opts?.migrationsStrict) {
        if (migration.name.includes("migrate-hostless")) {
          // Make sure the migrate hostless will try to unbundle the project
          // (otherwise they might just skip the bundle since there's no
          // dependency on hostless projects)
          const tmpBundler = new Bundler();
          const { siteOrProjectDep } = await unbundleSite(
            tmpBundler,
            bundle,
            db,
            entity
          );
          tmpBundler.bundle(
            siteOrProjectDep,
            entity.id,
            bundle.version || "0-new-version"
          );
        }
      }
    }
    if (opts?.migrationsStrict && DEVFLAGS.autoUpgradeHostless) {
      // Ditto
      const entity = { id: "id" } as PkgVersion | ProjectRevision;
      const db = {
        getPkgVersionById: (id: string) => {
          const res = newPkgVersionById.get(id);
          if (!res) {
            throw new Error("Unknown id " + id);
          }
          return {
            id,
            model: res.model,
          };
        },
        tryGetDevFlagOverrides: () => undefined,
        // Allowed during import only after saving the bundle
        allowProjectToDataSources: () => undefined,
      } as any;
      const tmpBundler = new Bundler();
      const { siteOrProjectDep } = await unbundleSite(
        tmpBundler,
        bundle,
        db,
        entity
      );
      tmpBundler.bundle(
        siteOrProjectDep,
        entity.id,
        bundle.version || "0-new-version"
      );
    }
    bundle.version = await getLastBundleVersion();
  };

  const fixXrefs = (bundle: Bundle) => {
    // Fix refs to the other deps
    const xrefs = getAllXRefs(bundle);
    xrefs.forEach((xref) => {
      xref.__xref.uuid = ensure(
        oldToNewUuid.get(xref.__xref.uuid),
        () =>
          `Xref to missing dep ${
            xref.__xref.uuid
          }, only know of ${JSON.stringify([...oldToNewUuid.keys()])}`
      );
    });

    bundle.deps = bundle.deps.map((s) =>
      ensure(
        oldToNewUuid.get(s),
        () =>
          `Missing dep ${s}, only know of ${JSON.stringify([
            ...oldToNewUuid.keys(),
          ])}`
      )
    );
  };

  for (const [i, [id, dep]] of depBundles.entries()) {
    fixXrefs(dep);

    const tmpUuid = mkUuid();
    await migrateBundle(dep);
    const projectDep = ensureKnownProjectDependency(
      bundler.unbundle(dep, tmpUuid)
    );

    let pkgVersion: PkgVersion;
    let newBundle: Bundle;
    if (
      !(await mgr.checkIfProjectIdExists(projectDep.projectId)) ||
      !opts?.keepProjectIdsAndNames
    ) {
      const { project, rev: fstRev } = await mgr.createProject({
        name: !opts?.keepProjectIdsAndNames
          ? `Imported Dep${depBundles.length > 1 ? ` ${i + 1}` : ""}`
          : projectDep.name,
        projectId: opts?.keepProjectIdsAndNames
          ? projectDep.projectId
          : undefined,
      });
      const pkg = await mgr.createPkgByProjectId(project.id);

      projectDep.pkgId = pkg.id;
      projectDep.projectId = project.id;
      projectDep.version = "0.0.1";

      const depSite = bundler.bundle(projectDep.site, tmpUuid, dep.version);
      newBundle = bundler.bundle(projectDep, tmpUuid, dep.version);

      const rev = await mgr.saveProjectRev({
        projectId: project.id,
        data: JSON.stringify(depSite),
        revisionNum: fstRev.revision + 1,
        seqIdAssign: undefined,
      });

      pkgVersion = await mgr.insertPkgVersion(
        pkg.id,
        "0.0.1",
        JSON.stringify(newBundle),
        [],
        "",
        rev.revision
      );
    } else {
      newBundle = bundler.bundle(projectDep, tmpUuid, dep.version);
      const pkg = await mgr.getPkgByProjectId(projectDep.projectId);
      assert(pkg, "Pkg not found");
      pkgVersion = await mgr.getPkgVersion(pkg.id, "0.0.1");
    }
    newPkgVersionById.set(pkgVersion.id, pkgVersion);
    // unbundle with the correct uuid
    ensureKnownProjectDependency(bundler.unbundle(newBundle, pkgVersion.id));
    oldToNewUuid.set(id, pkgVersion.id);
  }

  fixXrefs(siteBundle);
  await migrateBundle(siteBundle);

  const { project, rev } = await mgr.createProject({
    name:
      opts?.keepProjectIdsAndNames && opts?.projectName
        ? opts.projectName
        : `Imported Project`,
    projectId: opts?.keepProjectIdsAndNames ? _oldProjectId : undefined,
  });

  // Ensure we can unbundle the site
  const unbundledSite = ensureKnownSite(
    bundler.unbundle(siteBundle, project.id)
  );

  if (opts?.dataSourceReplacement) {
    let oldToNewSourceIds: Record<string, string> = {};
    const sourceIds = getAllOpExprSourceIdsUsedInSite(unbundledSite);
    if ("type" in opts.dataSourceReplacement) {
      const { type } = opts.dataSourceReplacement;
      const newDataSource = await mgr.createTutorialDbDataSource(
        type as TutorialType,
        project.workspaceId!,
        "Imported data source"
      );
      oldToNewSourceIds = _.fromPairs(
        sourceIds.map((id) => [id, newDataSource.id])
      );
    } else {
      const { fakeSourceId } = opts.dataSourceReplacement;
      oldToNewSourceIds = _.fromPairs(
        sourceIds.map((id) => [id, fakeSourceId])
      );
    }
    await reevaluateDataSourceExprOpIds(mgr, unbundledSite, oldToNewSourceIds);
    const newBundle = bundler.bundle(
      unbundledSite,
      project.id,
      siteBundle.version
    );
    Object.assign(siteBundle, newBundle);
  }

  const sourceIds = getAllOpExprSourceIdsUsedInSite(unbundledSite);
  // We try to allow, but if it fails, we ignore it, since this is to insert
  // a bundle we don't known if it's valid or not
  try {
    await mgr.allowProjectToDataSources(
      project.id,
      sourceIds as DataSourceId[]
    );
  } catch (err) {
    console.error(
      `Failed to allow project ${project.id} to data sources ${sourceIds.join(
        ","
      )}`,
      err
    );
  }

  const latestRev = await mgr.saveProjectRev({
    projectId: project.id,
    data: JSON.stringify(siteBundle),
    revisionNum: rev.revision + 1,
    seqIdAssign: undefined,
  });

  if (opts?.keepProjectIdsAndNames) {
    const pkg = await mgr.createPkgByProjectId(project.id);

    const dep = new ProjectDependency({
      uuid: mkShortId(),
      pkgId: pkg.id,
      projectId: project.id,
      version: "0.0.1",
      name: pkg.name,
      site: unbundledSite,
    });

    const depBundle = bundler.bundle(
      dep,
      project.id,
      await getLastBundleVersion()
    );

    const pkgVersion = await mgr.insertPkgVersion(
      pkg.id,
      "0.0.1",
      JSON.stringify(depBundle),
      [],
      "",
      latestRev.revision
    );

    ensureKnownProjectDependency(bundler.unbundle(depBundle, pkgVersion.id));
  }

  return project;
}

async function importFullProjectData(
  data: ProjectFullDataResponse,
  mgr: DbMgr,
  bundler: Bundler
) {
  const { branches, pkgVersions, project: projectData, revisions } = data;
  const { project: newProject } = await mgr.createProject({
    name: `Imported Project (${projectData.name})`,
  });
  const newPkg = await mgr.createPkgByProjectId(newProject.id);
  const oldToNewPkgVersionId = new Map<string, string>();
  const newPkgVersionById = new Map<string, PkgVersion>();
  const oldToNewProjectId = new Map<ProjectId, ProjectId>([
    [projectData.id, newProject.id],
  ]);
  const oldProjectIdToNewPkgId = new Map<ProjectId, string>([
    [projectData.id, newPkg.id],
  ]);

  const migrateBundle = async (bundle: Bundle) => {
    const migrations = await getMigrationsToExecute(bundle.version);
    for (const migration of migrations) {
      await migration.migrate(
        bundle,
        {
          getPkgVersionById: (id: string) => {
            const res = newPkgVersionById.get(id);
            if (!res) {
              throw new Error("Unknown id " + id);
            }
            return {
              id,
              model: res.model,
            };
          },
          tryGetDevFlagOverrides: () => undefined,
        } as any,
        { id: "id" } as PkgVersion | ProjectRevision
      );
      bundle.version = migration.name;
    }
    bundle.version = await getLastBundleVersion();
  };

  const fixXrefs = (bundle: Bundle) => {
    // Fix refs to the other deps
    const xrefs = getAllXRefs(bundle);
    xrefs.forEach((xref) => {
      xref.__xref.uuid = ensure(
        oldToNewPkgVersionId.get(xref.__xref.uuid),
        () =>
          `Xref to missing dep ${
            xref.__xref.uuid
          }, only know of ${JSON.stringify([...oldToNewPkgVersionId.keys()])}`
      );
    });

    bundle.deps = bundle.deps.map((s) =>
      ensure(
        oldToNewPkgVersionId.get(s),
        () =>
          `Missing dep ${s}, only know of ${JSON.stringify([
            ...oldToNewPkgVersionId.keys(),
          ])}`
      )
    );
  };

  let tmpBranch: Branch | undefined = undefined;
  let tmpBranchVersion = 1;

  if (pkgVersions[0] && pkgVersions[0].branchId !== MainBranchId) {
    // The ancestor pkg version must be in main branch
    pkgVersions[0].branchId = MainBranchId;
    pkgVersions[0].version = "0.0.0"; // Avoid duplicate versions / ancestor with higher version
  }

  // Store dependencies and published versions
  for (const [
    i,
    { data: dep, id: oldId, projectId: depProjectId, version, branchId },
  ] of pkgVersions.entries()) {
    fixXrefs(dep);
    const tmpUuid = mkUuid();
    await migrateBundle(dep);
    const projectDep = ensureKnownProjectDependency(
      bundler.unbundle(dep, tmpUuid)
    );

    let newProjectId = oldToNewProjectId.get(depProjectId);
    let newPkgId = oldProjectIdToNewPkgId.get(depProjectId);
    let latestRev: number;
    if (!newProjectId || !newPkgId) {
      const { project, rev: fstRev } = await mgr.createProject({
        name: `Imported Dep${pkgVersions.length > 1 ? ` ${i + 1}` : ""}`,
      });
      newProjectId = project.id;
      oldToNewProjectId.set(depProjectId, newProjectId);
      const pkg = await mgr.createPkgByProjectId(project.id);
      newPkgId = pkg.id;
      oldProjectIdToNewPkgId.set(depProjectId, newPkgId);
      latestRev = fstRev.revision;
    } else {
      latestRev = await mgr.getLatestProjectRevNumber(newProjectId);
    }

    projectDep.pkgId = newPkgId;
    projectDep.projectId = newProjectId;
    projectDep.version = version;

    const depSite = bundler.bundle(projectDep.site, tmpUuid, dep.version);
    const newBundle = bundler.bundle(projectDep, tmpUuid, dep.version);

    const rev = await mgr.saveProjectRev({
      projectId: newProjectId,
      data: JSON.stringify(depSite),
      revisionNum: latestRev + 1,
      seqIdAssign: undefined,
    });

    if (branchId !== MainBranchId) {
      // We shouldn't save PkgVersions from other branches into main
      if (!tmpBranch) {
        const prevPkgVersion = oldToNewPkgVersionId.get(pkgVersions[i - 1].id);
        tmpBranch = await mgr.createBranch(newProject.id, {
          name: "tmp-branch-" + mkShortId(),
          pkgVersion: ensure(
            newPkgVersionById.get(prevPkgVersion!),
            () => `Failed to get PkgVersion by id ${prevPkgVersion}`
          ),
        });
      }
    }

    const pkgVersion = await mgr.insertPkgVersion(
      newPkgId,
      branchId !== MainBranchId ? `0.0.${tmpBranchVersion++}` : version,
      JSON.stringify(newBundle),
      [],
      "",
      rev.revision,
      branchId !== MainBranchId ? tmpBranch!.id : undefined
    );

    // unbundle with the correct uuid
    ensureKnownProjectDependency(bundler.unbundle(newBundle, pkgVersion.id));
    oldToNewPkgVersionId.set(oldId, pkgVersion.id);
    newPkgVersionById.set(pkgVersion.id, pkgVersion);
  }

  const oldToNewBranchId = new Map<BranchId, BranchId>();

  // Store latest branch revisions
  for (const branchData of [...branches, { id: MainBranchId, name: "main" }]) {
    const oldPkgVersionId = projectData.commitGraph.branches[branchData.id];
    const newPkgVersionId = ensure(
      oldToNewPkgVersionId.get(oldPkgVersionId),
      () => `Failed to get new uuid for PkgVersion ${oldPkgVersionId}`
    );
    let newBranchId: BranchId | undefined = undefined;
    const branchRevisionData = ensure(
      revisions.find(({ branchId }) => branchId === branchData.id),
      () =>
        `Couldn't find revision for branch ${branchData.name} (${branchData.id})`
    );

    if (branchData.id !== MainBranchId) {
      const newBranch = await mgr.createBranch(newProject.id, {
        name: branchData.name,
        pkgVersion: ensure(
          newPkgVersionById.get(newPkgVersionId),
          () => `Failed to get PkgVersion by id ${newPkgVersionId}`
        ),
      });
      newBranchId = newBranch.id;
      oldToNewBranchId.set(branchData.id as BranchId, newBranchId);
    }

    const revBundle = branchRevisionData.data;
    fixXrefs(revBundle);
    // Ensure we can unbundle the site
    await migrateBundle(revBundle);
    ensureKnownSite(bundler.unbundle(revBundle, mkUuid()));

    await mgr.saveProjectRev({
      projectId: newProject.id,
      data: JSON.stringify(revBundle),
      revisionNum:
        (await mgr.getLatestProjectRevNumber(
          newProject.id,
          branchData.id !== MainBranchId ? { branchId: newBranchId } : undefined
        )) + 1,
      seqIdAssign: undefined,
      ...(branchData.id !== MainBranchId ? { branchId: newBranchId } : {}),
    });
  }

  // Update commit graph
  // We don't send all commits as it would be too much data, so we only send
  // the pkgVersions for each branch and each pair of lowest common ancestor
  // they have (which are the only reachable pkgVersions by the merge algorithm)
  // so we need to fill fake values for the other PkgVersions
  for (const oldPkgVersionId of Object.keys(projectData.commitGraph.parents)) {
    if (oldToNewPkgVersionId.has(oldPkgVersionId)) {
      continue;
    }
    if (!tmpBranch) {
      const prevPkgVersion = oldToNewPkgVersionId.get(last(pkgVersions)!.id);
      tmpBranch = await mgr.createBranch(newProject.id, {
        name: "tmp-branch-" + mkShortId(),
        pkgVersion: ensure(
          newPkgVersionById.get(prevPkgVersion!),
          () => `Failed to get PkgVersion by id ${prevPkgVersion}`
        ),
      });
    }
    const pkgVersion = await mgr.insertPkgVersion(
      newPkg.id,
      `0.0.${tmpBranchVersion++}`,
      "{}",
      [],
      "",
      1,
      tmpBranch!.id
    );
    oldToNewPkgVersionId.set(oldPkgVersionId, pkgVersion.id);
  }
  if (tmpBranch) {
    await mgr.deleteBranch(tmpBranch.id);
  }
  await mgr.maybeUpdateCommitGraphForProject(newProject.id, (graph) => {
    graph.branches = Object.fromEntries(
      withoutNils(
        Object.entries(projectData.commitGraph.branches).map(
          ([oldBranchId, oldPkgVersionId]) =>
            oldBranchId === MainBranchId ||
            oldToNewBranchId.has(oldBranchId as BranchId)
              ? [
                  oldBranchId === MainBranchId
                    ? oldBranchId
                    : ensure(
                        oldToNewBranchId.get(oldBranchId as BranchId),
                        () => `Couldn't find new branch for ${oldBranchId}`
                      ),
                  ensure(
                    oldToNewPkgVersionId.get(oldPkgVersionId),
                    () =>
                      `Couldn't find new pkgVersionId for ${oldPkgVersionId}`
                  ) as PkgVersionId,
                ]
              : undefined
        )
      )
    );
    graph.parents = Object.fromEntries(
      Object.entries(projectData.commitGraph.parents).map(
        ([oldChildrenId, oldParentIds]) => [
          ensure(
            oldToNewPkgVersionId.get(oldChildrenId),
            () => `Couldn't find new pkgVersionId for ${oldChildrenId}`
          ),
          oldParentIds.map((oldParentId) =>
            ensure(
              oldToNewPkgVersionId.get(oldParentId),
              () => `Couldn't find new pkgVersionId for ${oldParentId}`
            )
          ),
        ]
      )
    );
  });

  return newProject;
}

export async function getModelUpdates(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  req.promLabels.projectId = projectId;
  const {
    revisionNum,
    installedDeps: installedDepsArray,
    branchId,
  } = parseQueryParams(req);
  const installedDeps = new Set<string>(installedDepsArray);
  const getDeps = async (bundle: Bundle) => {
    if (bundle.deps.every((dep) => installedDeps.has(dep))) {
      return [];
    }
    return loadDepPackages(mgr, bundle);
  };

  const partialChanges = L.sortBy(
    await mgr.getPartialRevsFromRevisionNumber(
      projectId,
      revisionNum,
      branchId
    ),
    (p) => p.revision
  );
  const latestVersion = await getLastBundleVersion();
  if (
    partialChanges.length === 0 ||
    partialChanges[0].revision !== revisionNum + 1
  ) {
    const rev = await mgr.getLatestProjectRev(projectId, {
      branchId,
      revisionNumOnly: true,
    });
    if (rev.revision === revisionNum) {
      // Up to date - no data to fetch
      res.json({ data: null });
    } else {
      // We don't have the incremental changes starting from that revision in
      // cache, so the project will need to reload the entire revision
      res.json({
        needsReload: true,
      });
    }
  } else {
    // Merge partial changes since that revision
    let data = getBundle(partialChanges[0], latestVersion);
    const deletedIids = new Set(
      JSON.parse(partialChanges[0].deletedIids) as string[]
    );
    for (const change of partialChanges.slice(1)) {
      const changeBundle = getBundle(change, latestVersion);
      const newDeletedIids = JSON.parse(change.deletedIids) as string[];
      Object.keys(changeBundle.map).forEach((iid) => deletedIids.delete(iid));
      newDeletedIids.forEach((iid) => deletedIids.add(iid));
      const newMap = { ...data.map };
      Object.entries(changeBundle.map).forEach(([iid, json]) => {
        if (newMap[iid]) {
          assert(
            newMap[iid].__type === json.__type,
            `newMap[${iid}] has type ${newMap[iid].__type} but json.__type is ${json.__type}`
          );
          Object.assign(newMap[iid], json);
        } else {
          newMap[iid] = json;
        }
      });
      data = {
        ...L.omit(changeBundle, ["map"]),
        map: newMap,
      };
    }
    const deps = await getDeps(data);

    res.json({
      data: JSON.stringify(data),
      revision: ensure(
        L.last(partialChanges),
        "Couldn't find last partialChange"
      ).revision,
      depPkgs: deps.filter((dep) => !installedDeps.has(dep.id)),
      deletedIids: Array.from(deletedIids),
    });
  }
}

async function ensureSchemaIsUpToDate(req: Request) {
  if (modelSchemaHash !== req.body.modelSchemaHash) {
    throw new SchemaMismatchError();
  }

  const db = userDbMgr(req);
  if (
    req.body.hostlessDataVersion !==
    (await db.getHostlessVersion()).versionCount
  ) {
    throw new SchemaMismatchError();
  }

  try {
    getBundle(req.body, await getLastBundleVersion());
  } catch (e) {
    if (e instanceof OutdatedBundleError) {
      throw new SchemaMismatchError();
    }
    throw e;
  }

  const latestModelVersion = await getCurrentModelVersion(req.txMgr);
  if (req.body.modelVersion !== latestModelVersion) {
    console.log(
      "stale model version",
      req.body.modelVersion,
      "!==",
      latestModelVersion
    );
    throw new SchemaMismatchError();
  }
}

export async function tryMergeBranch(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { subject, pretend, resolution, autoCommitOnToBranch } =
    req.body as TryMergeRequest;
  const mergeResult = pretend
    ? await mgr.previewMergeBranch({
        ...subject,
        resolution,
        autoCommitOnToBranch,
        excludeMergeStepFromResult: true,
      })
    : await mgr.tryMergeBranch({
        ...subject,
        resolution,
        autoCommitOnToBranch,
        excludeMergeStepFromResult: true,
      });
  // Prevent attempting to serialize MergeStep (not serializable)
  delete mergeResult["mergeStep"];
  res.json(
    ensureType<TryMergeResponse>({
      ...mergeResult,
    })
  );
}
export async function saveProjectRev(req: Request, res: Response) {
  await ensureSchemaIsUpToDate(req);

  const mgr = userDbMgr(req);
  const { projectId, branchId } = parseProjectBranchId(
    req.params.projectBranchId
  );

  const mergedBundle: Bundle = await (async () => {
    if (req.body.incremental) {
      const rev = await mgr.getLatestProjectRev(projectId, { branchId });

      if (rev.revision + 1 !== +req.params.revision) {
        // Don't try to merge the bundles since the revision number is not
        // compatible (to avoid bundle reference errors that come from
        // concurrent editing conflicts).
        throw new ProjectRevisionError(
          `Tried saving revision ${+req.params.revision}, but expecting ${
            rev.revision + 1
          } since latest saved revision is ${rev.revision}`
        );
      }

      const bundle = await getMigratedBundle(rev);
      const latestRevMap = bundle.map;
      const mergedData = getBundle(req.body, await getLastBundleVersion());
      const updatedMap = mergedData.map;
      mergedData.map = { ...latestRevMap };
      Object.entries(updatedMap).forEach(([iid, partialInst]) => {
        if (!mergedData.map[iid]) {
          mergedData.map[iid] = partialInst;
        } else {
          assert(
            mergedData.map[iid].__type === partialInst.__type,
            `mergedData.map[${iid}] has type ${mergedData.map[iid].__type} but partialInst.__type is ${partialInst.__type}`
          );
          Object.assign(mergedData.map[iid], partialInst);
        }
      });
      const toDeleteIids: string[] = req.body.toDeleteIids || [];
      toDeleteIids.forEach((iid) => delete mergedData.map[iid]);
      try {
        checkExistingReferences(mergedData);
      } catch (e) {
        Sentry.captureException(e);
        // If there are errors in references, it could be due to dangling
        // references pointing to invalid external deps after upgrading
        // a project dependency.  Not sure how they are dangling.  But we
        // try to remove those unreachable nodes here:
        removeUnreachableNodesFromBundle(mergedData);
        try {
          checkExistingReferences(mergedData);
        } catch (err) {
          // If there are still errors, then we give up :-/
          Sentry.captureException(err);
          throw new UnknownReferencesError();
        }
      }
      try {
        checkBundleFields(mergedData);
        checkRefsInBundle(mergedData);
      } catch (e) {
        Sentry.captureException(e);
        throw new BundleTypeError();
      }
      return mergedData;
    } else {
      const bundle = getBundle(req.body, await getLastBundleVersion());
      checkBundleFields(bundle);
      checkRefsInBundle(bundle);
      return bundle;
    }
  })();

  await moveBundleAssetsToS3(mergedBundle);

  // Prefer re using the bundle up to this point, so that it won't require running
  // multiple JSON.stringify()/JSON.parse() on large bundles
  const data = JSON.stringify(mergedBundle);

  const project = await mgr.getProjectById(projectId);
  req.promLabels.projectId = projectId;
  userAnalytics(req).track({
    event: "Save project",
    properties: {
      projectId: project.id,
      projectName: project.name,
      revision: +req.params.revision,
      branchId,
    },
  });

  const rev = await mgr.saveProjectRev({
    projectId,
    data: data,
    revisionNum: +req.params.revision,
    seqIdAssign: undefined,
    branchId,
  });

  if (req.body.incremental) {
    const partial = await (async () => {
      const bundle = getBundle({ data }, await getLastBundleVersion());
      const partialData = getBundle(req.body, await getLastBundleVersion());
      bundle.map = L.pick(bundle.map, Object.keys(partialData.map)) as any;
      Object.keys(bundle.map).forEach((iid) => {
        const fields = Object.keys(partialData.map[iid]);
        bundle.map[iid] = L.pick(bundle.map[iid], fields) as any;
      });
      return JSON.stringify(bundle);
    })();

    const deletedIids: string[] = req.body.toDeleteIids || [];

    await mgr.savePartialRevision({
      projectId,
      revisionNum: +req.params.revision,
      data: partial,
      deletedIids: JSON.stringify(deletedIids),
      branchId,
      projectRevisionId: rev.id,
    });
  } else {
    // If we're saving the entire bundle, it's better not to save it as an
    // incremental change, so we just clear the cached partial changes
    await mgr.clearPartialRevisionsCacheForProject(projectId, branchId);
  }

  res.json({ rev: _.omit(rev, "data") });

  // We resolve the transaction first before we broadcast the new updates
  // to other players
  await req.resolveTransaction();

  // Broadcast to the new project revision to all listeners
  await broadcastProjectsMessage({
    room: `projects/${project.id}`,
    type: "update",
    message: { projectId: project.id, revisionNum: rev.revision },
  });
}

export async function getCurrentModelVersion(em: EntityManager) {
  const conn = em.connection;
  const migrator = new MigrationExecutor(conn, em.queryRunner);
  const migrations = await migrator.getExecutedMigrations();
  return Math.max(
    -1,
    ...migrations.map((m) => (m.id === undefined ? -1 : m.id))
  );
}

export async function listBranchesForProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const branches = await mgr.listBranchesForProject(projectId);
  res.json(
    ensureType<ListBranchesResponse>({
      branches,
    })
  );
}

export async function createBranch(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const { name, sourceBranchId } = req.body as CreateBranchRequest;
  const branch = sourceBranchId
    ? await mgr.cloneBranch(sourceBranchId, { name })
    : await mgr.createBranchFromLatestPkgVersion(projectId, {
        name,
      });
  res.json(
    ensureType<CreateBranchResponse>({
      branch,
    })
  );
}

export async function deleteBranch(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const branchId = req.params.branchId as BranchId;
  await mgr.deleteBranch(branchId);
  res.json({});
}

export async function updateBranch(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const args = req.body as UpdateBranchRequest;
  const branchId = req.params.branchId as BranchId;
  await mgr.updateBranch(branchId, args);
  res.json({});
}

export async function getProjectRev(req: Request, res: Response) {
  const revisionId = req.query.revisionId
    ? JSON.parse(req.query.revisionId as string)
    : undefined;
  const revisionNum = req.query.revisionNum;
  if (revisionNum !== undefined) {
    console.log(`revisionNum is ${revisionNum}. ${L.isString(revisionNum)}`);
  }
  const dontMigrateProject =
    !!req.query.dontMigrateProject &&
    (JSON.parse(req.query.dontMigrateProject as string) as boolean);
  const mgr = userDbMgr(req);
  const { projectId, branchId } = parseProjectBranchId(
    req.params.projectBranchId
  );
  const branch = branchId ? await mgr.getBranchById(branchId) : undefined;
  const project = await mgr.getProjectById(projectId);
  req.promLabels.projectId = projectId;
  const rev =
    revisionNum !== undefined
      ? await mgr.getProjectRevision(project.id, +revisionNum, branchId)
      : revisionId
      ? await mgr.getProjectRevisionById(projectId, revisionId, branchId)
      : await mgr.getLatestProjectRev(projectId, { branchId });
  const perms = project.readableByPublic
    ? (await mgr.getPermissionsForProject(projectId)).filter((perm) => {
        return accessLevelRank(perm.accessLevel) >= accessLevelRank("content");
      })
    : await mgr.getPermissionsForProject(projectId);
  const depPkgs = await loadDepPackages(
    mgr,
    dontMigrateProject ? JSON.parse(rev.data) : await getMigratedBundle(rev),
    { dontMigrateBundle: dontMigrateProject }
  );
  const modelVersion = await getCurrentModelVersion(req.txMgr);
  const hostlessDataVersion = (await mgr.getHostlessVersion()).versionCount;
  const owner = await mgr.tryGetUserById(
    ensure(project.createdById, "Unexpected nullish project.createdById")
  );
  const latestRevisionSynced = await getLatestRevisionSynced(mgr, projectId);
  // Make sure this revision bundle is up to date.
  if (!dontMigrateProject) {
    await getMigratedBundle(rev);
  }

  const appAuthConfig = await mgr.getPublicAppAuthConfig(projectId);
  const hasAppAuth = !!appAuthConfig;
  const appAuthProvider = appAuthConfig?.provider;

  const allowedDataSourceIds = (
    await mgr.listAllowedDataSourcesForProject(projectId as ProjectId)
  ).map((ds) => ds.dataSourceId);

  const workspaceTutorialDbs = project.workspaceId
    ? (await mgr.getWorkspaceTutorialDataSources(project.workspaceId))
        .filter(
          (ds) =>
            ds.source === "tutorialdb" && allowedDataSourceIds.includes(ds.id)
        )

        .map((ds) => mkApiDataSource(ds))
    : [];

  userAnalytics(req).track({
    event: "Open project",
    properties: {
      projectId: project.id,
      projectName: project.name,
      revision: rev.revision,
      branchId,
      branchName: branch?.name,
    },
  });
  res.json({
    rev,
    project: mkApiProject(project),
    perms,
    depPkgs,
    modelVersion,
    hostlessDataVersion,
    owner,
    latestRevisionSynced,
    hasAppAuth,
    appAuthProvider,
    workspaceTutorialDbs,
  });
}

export async function getProjectRevWithoutData(req: Request, res: Response) {
  const revisionId = req.query.revisionId
    ? JSON.parse(req.query.revisionId as string)
    : undefined;
  const branchId = req.query.branchId
    ? JSON.parse(req.query.branchId as string)
    : undefined;
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const project = await mgr.getProjectById(projectId);
  req.promLabels.projectId = projectId;
  const rev = _.omit(
    revisionId
      ? await mgr.getProjectRevisionById(
          projectId,
          revisionId,
          branchId ? branchId : undefined
        )
      : await mgr.getLatestProjectRev(
          projectId,
          branchId ? { branchId } : undefined
        ),
    "data"
  );
  const perms = project.readableByPublic
    ? (await mgr.getPermissionsForProject(projectId)).filter((perm) => {
        return accessLevelRank(perm.accessLevel) >= accessLevelRank("content");
      })
    : await mgr.getPermissionsForProject(projectId);
  res.json(
    ensureType<ProjectRevWithoutDataResponse>({
      rev,
      project: mkApiProject(project),
      perms,
    })
  );
}

export async function getFullProjectData(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const branchIdOrNames = JSON.parse(req.query.branchIds as string) as string[];
  const { branches, pkgVersions, project, revisions, commitGraph } =
    await mgr.getProjectAndBranchesByIdOrNames(projectId, branchIdOrNames);
  const revBundles = await Promise.all(
    revisions.map((rev) => getMigratedBundle(rev))
  );
  const pkgVersionBundles = await Promise.all(
    pkgVersions.map((pkgVersion) => getMigratedBundle(pkgVersion))
  );
  const deps = await loadDepPackages(mgr, [
    ...revBundles,
    ...pkgVersionBundles,
  ]);
  res.json(
    ensureType<ProjectFullDataResponse>({
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
      })),
      pkgVersions: await Promise.all(
        [...deps, ...pkgVersions].map(async (pkgVersion) => ({
          id: pkgVersion.id,
          data: await getMigratedBundle(pkgVersion),
          projectId: (await mgr.getPkgById(pkgVersion.pkgId)).projectId,
          version: pkgVersion.version,
          branchId: (pkgVersion.branchId as BranchId) ?? MainBranchId,
        }))
      ),
      project: {
        id: project.id,
        name: project.name,
        commitGraph,
      },
      revisions: await Promise.all(
        revisions.map(async (rev) => ({
          branchId: rev.branchId ?? MainBranchId,
          data: await getMigratedBundle(rev),
        }))
      ),
    })
  );
}

export async function updateProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const data = req.body;
  const projectId = req.params.projectId;
  let regeneratedSecretApiToken: string | undefined = undefined;
  const project = await mgr.updateProject({
    id: projectId,
    ...data,
    ...(data.secretApiToken
      ? { secretApiToken: (regeneratedSecretApiToken = generateSomeApiToken()) }
      : {}),
  });

  req.promLabels.projectId = project.id;
  const apiProject = mkApiProject(project);
  const perms = project.readableByPublic
    ? (await mgr.getPermissionsForProject(projectId)).filter((perm) => {
        return accessLevelRank(perm.accessLevel) >= accessLevelRank("content");
      })
    : await mgr.getPermissionsForProject(projectId);
  const owner = await mgr.tryGetUserById(
    ensure(project.createdById, "Unexpected nullish project.createdById")
  );
  const latestRevisionSynced = await getLatestRevisionSynced(mgr, projectId);
  const affectedResourceIds = [
    createTaggedResourceId("project", project.id),
    ...(apiProject.teamId
      ? [createTaggedResourceId("team", apiProject.teamId)]
      : []),
  ];

  if (data.workspaceId) {
    await mgr.moveAppAuthToWorkspace(projectId as ProjectId, data.workspaceId);
  }

  const response: UpdateProjectResponse = {
    project: apiProject,
    perms,
    owner,
    latestRevisionSynced,
    regeneratedSecretApiToken,
  };

  // Bypass paywall if project is not being moved to a different workspace.
  if (data.workspaceId) {
    res.json(await maybeTriggerPaywall(req, affectedResourceIds, {}, response));
  } else {
    res.json(passPaywall(response));
  }
}

export async function updateHostUrl(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const data = req.body as UpdateHostUrlRequest;
  const projectId = req.params.projectId;
  if (
    !("hostUrl" in data) ||
    (data.hostUrl != null && !isString(data.hostUrl))
  ) {
    throw new BadRequestError(
      `Unexpected hostUrl to be of type ${typeof data.hostUrl}`
    );
  }
  console.log("Updating project hostUrl", projectId, data.hostUrl);
  if (data.branchId == null) {
    const project = await mgr.updateProject({
      id: projectId,
      hostUrl: data.hostUrl,
    });
    res.json(
      ensureType<UpdateHostUrlResponse>({
        hostUrl: project.hostUrl,
        branchId: null,
        updatedAt: project.updatedAt,
      })
    );
  } else {
    const branch = await mgr.updateBranch(data.branchId, {
      hostUrl: data.hostUrl,
    });
    if (branch.projectId !== projectId) {
      throw new NotFoundError(`Branch with ID ${data.branchId} not found`);
    }
    res.json(
      ensureType<UpdateHostUrlResponse>({
        hostUrl: branch.hostUrl,
        branchId: branch.id,
        updatedAt: branch.updatedAt,
      })
    );
  }
}

const _ProofSafeDelete: ProofSafeDelete = brand({ SafeDelete: "SafeDelete" });

/**
 * Delete a project while performing clean-up of any associated external resources.
 *
 * Currently this just means freeing up domains from Vercel.
 *
 * Note that this is not reverted by restoreProject().
 */
export async function doSafelyDeleteProject(
  dbMgr: DbMgr,
  domainValidator: DomainValidator,
  projectId: ProjectId
) {
  await onProjectDelete(dbMgr, projectId, domainValidator);
  await dbMgr.deleteProject(projectId, _ProofSafeDelete);
}

export async function deleteProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  await doSafelyDeleteProject(
    mgr,
    new DomainValidator(req.devflags.plasmicHostingSubdomainSuffix),
    brand(req.params.projectId)
  );
  req.promLabels.projectId = req.params.projectId;
  res.json({ deletedId: req.params.projectId });
}

export async function removeSelfPerm(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  await mgr.removeSelfPerm(req.params.projectId);
  res.json({});
}

/**
 * @deprecated
 * To be removed once we start using generic `changeResourcePermissions`
 */
export async function changeProjectPermissions(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { projectId } = req.params;
  const { grants, revokes } = uncheckedCast<GrantRevokeRequest>(req.body);
  const project = await mgr.getProjectById(projectId);
  req.promLabels.projectId = projectId;
  let enqueued = false;
  for (const { email, accessLevel } of grants) {
    // Note: we intentionally do not check whether this is a new permission or
    // not. We always re-send share emails if the user re-requested sharing with
    // a user!
    await mgr.grantProjectPermissionByEmail(projectId, email, accessLevel);
    if (
      req.devflags.allowAllShareInvites &&
      !(await mgr.isUserWhitelisted(email)) &&
      !(await mgr.tryGetUserByEmail(email))
    ) {
      await superDbMgr(req).addToWhitelist({ email });
    }
    if (
      (await mgr.isUserWhitelisted(email)) ||
      (await mgr.tryGetUserByEmail(email))
    ) {
      userAnalytics(req).track({
        event: "Invite others to this project",
        properties: {
          projectId,
          projectName: project.name,
          email,
          accessLevel,
        },
      });
      await sendShareEmail(
        req,
        getUser(req),
        email,
        "project",
        project.name,
        createProjectUrl(req.config.host, project.id),
        !!(await mgr.tryGetUserByEmail(email))
      );
    } else {
      await mgr.logInviteRequest(email, project.id);
      await sendInviteApprovalAdminEmail(req, email, project);
      enqueued = true;
    }
  }
  if (revokes.length > 0) {
    await mgr.revokeProjectPermissionsByEmails(
      projectId,
      revokes.map(({ email }) => email)
    );
  }

  const perms = await mgr.getPermissionsForProject(projectId);
  res.json(ensureType<GrantRevokeResponse>({ perms, enqueued }));
}

export async function getLatestBundleVersion(req: Request, res: Response) {
  const version = await getLastBundleVersion();
  res.json({ latestBundleVersion: version });
}

export async function getLatestPlumePkg(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const pkg = await mgr.getLatestPlumePkgVersion();
  res.json({ pkg });
}

export async function getPlumePkg(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const pkg = await mgr.getPlumePkgVersion();
  res.json(await getPkgWithDeps(mgr, pkg));
}

export async function getPlumePkgVersionStrings(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const versionStrings = await mgr.getPlumePkgVersionStrings();
  res.json({ versions: versionStrings });
}

export async function getPkgByProjectId(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const pkg = await mgr.getPkgByProjectId(projectId);
  req.promLabels.projectId = projectId;
  res.json({ pkg });
}

export async function createPkgByProjectId(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const pkg = await mgr.createPkgByProjectId(projectId);
  req.promLabels.projectId = projectId;
  res.json({ pkg });
}

async function getPkgWithDeps(
  mgr: DbMgr,
  pkg: PkgVersion,
  meta?: boolean,
  opts?: { dontMigrateProject?: boolean }
) {
  const bundle: Bundle = opts?.dontMigrateProject
    ? JSON.parse(pkg.model)
    : await getMigratedBundle(pkg);
  const depPkgs = await loadDepPackages(mgr, bundle);

  // Ensure deps pkg bundles are up to date.
  await Promise.all(depPkgs.map((depPkg) => getMigratedBundle(depPkg)));
  const result = meta
    ? {
        pkg: _.omit(pkg, "model"),
        depPkgs: _.map(depPkgs, (v) => _.omit(v, "model")),
      }
    : {
        pkg,
        depPkgs,
      };
  return result;
}

export async function getPkgVersion(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const pkgId: string = req.params.pkgId;
  const version: string | undefined = req.query.version
    ? JSON.parse(req.query.version as string)
    : undefined;
  const meta: boolean | undefined = req.query.meta
    ? JSON.parse(req.query.meta as string)
    : undefined;
  const branchId = req.query.branchId
    ? JSON.parse(req.query.branchId as string)
    : undefined;
  const dontMigrateProject = !!req.query.dontMigrateProject;

  const pkg = await mgr.getPkgVersion(
    pkgId,
    version,
    undefined,
    branchId ? { branchId } : undefined
  );
  res.json(await getPkgWithDeps(mgr, pkg, meta, { dontMigrateProject }));
}

export async function publishProject(req: Request, res: Response) {
  const body = uncheckedCast<PublishProjectRequest>(req.body);
  if (!semver.valid(body.version)) {
    throw new BadRequestError(
      `Invalid publish version; please use a valid semver version like "1.2.3".`
    );
  }
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  console.log(`Publishing project ${projectId}...`);
  const { pkgVersion, usedSiteFeatures } = await mgr.publishProject(
    projectId,
    body.version,
    body.tags,
    body.description,
    body.revisionNum,
    body.hostLessPackage,
    body.branchId
  );
  req.promLabels.projectId = projectId;
  userAnalytics(req).track({
    event: "Publish project",
    properties: {
      pkgId: req.params.pkgId,
    },
  });
  const project = await mgr.getProjectById(projectId);
  const affectedResourceIds = [
    createTaggedResourceId("project", projectId),
    ...(project.workspace?.teamId
      ? [createTaggedResourceId("team", project.workspace?.teamId)]
      : []),
  ];

  // This ends the request and closes the database connection
  res.json(
    await maybeTriggerPaywall(
      req,
      affectedResourceIds,
      {
        [projectId]: [...usedSiteFeatures],
      },
      { pkg: _.omit(pkgVersion, "model") },
      undefined,
      {
        verifyMonthlyViews: false,
      }
    )
  );

  console.log(`Publishing project ${projectId}... done`);

  await req.resolveTransaction();

  // Take this opportunity to fire off a pre-fill request to codegen-origin
  console.log(
    `Pre-filling for ${projectId}@${pkgVersion.version} against ${req.devflags.codegenOriginHost}`
  );
  try {
    const fetchResponse = await fetch(
      `${req.devflags.codegenOriginHost}/api/v1/loader/code/prefill/${pkgVersion.id}`,
      {
        method: "POST",
      }
    );
    if (fetchResponse.status !== 200) {
      throw new Error(await fetchResponse.text());
    }
  } catch (err) {
    await req.con.transaction(async (entMgr) => {
      console.error(
        `Error pre-filling ${projectId}@${pkgVersion.version}; marking as pre-filled anyway`,
        err
      );
      const superMgr = new DbMgr(entMgr, SUPER_USER);
      await superMgr.updatePkgVersion(
        pkgVersion.pkgId,
        pkgVersion.version,
        pkgVersion.branchId,
        {
          isPrefilled: true,
        }
      );
    });
  }

  // Broadcast to publish listeners
  console.log(
    `Broadcasting publish event for ${projectId}@${pkgVersion.version}`
  );
  await broadcastProjectsMessage({
    room: `projects/${projectId}`,
    type: "publish",
    message: { projectId: projectId, ..._.omit(pkgVersion, "model") },
  });
}

export async function getPkgVersionPublishStatus(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  req.promLabels.projectId = projectId;
  const projectApiToken = await mgr.validateOrGetProjectApiToken(projectId);
  const loaderPubilshments = await mgr.getRecentLoaderPublishments(projectId);
  const pkgVersionId = req.params.pkgVersionId;
  const pkgVersion = await mgr.getPkgVersionById(pkgVersionId);

  let isRedirectingToLatest = false;

  if (loaderPubilshments.length > 0) {
    // We validate if we are redirecting to a version that is bigger than the
    // version of `pkgVersion`, if we aren't than we consider that the prefilling
    // is not finished yet
    const redirectRes = await fetch(
      `${getCodegenUrl()}/api/v1/loader/code/published?projectId=${projectId}`,
      {
        redirect: "manual",
        headers: {
          "x-plasmic-api-project-tokens": `${projectId}:${projectApiToken}`,
        },
      }
    );
    const redirectLocation = redirectRes.headers.get("location");
    if (redirectLocation) {
      try {
        const decodedUri = decodeURIComponent(redirectLocation);
        const redirectProjectId = new URL(decodedUri).searchParams.get(
          "projectId"
        );
        const redirectProjectVersion =
          redirectProjectId && redirectProjectId.split("@")[1];

        if (
          redirectProjectVersion &&
          semver.satisfies(redirectProjectVersion, `>=${pkgVersion.version}`)
        ) {
          isRedirectingToLatest = true;
        }
      } catch (e) {
        // if we catch an error while decoding the url, we are going to consider that
        // that the redirection is succesfull. The exception is going to be sent to
        // sentry
        isRedirectingToLatest = true;
        Sentry.captureException(e);
      }
    }
  } else {
    isRedirectingToLatest = true;
  }

  res.json({
    status:
      (pkgVersion.isPrefilled == null || pkgVersion.isPrefilled) &&
      isRedirectingToLatest
        ? "ready"
        : "pre-filling",
  });
}

export async function listPkgVersionsWithoutData(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const pkgId = req.params.pkgId;
  const branchId =
    req.query.branchId != null
      ? (JSON.parse(req.query.branchId as string) as BranchId)
      : undefined;
  const pkgVersions = await mgr.listPkgVersions(pkgId, {
    includeData: false,
    branchId,
  });
  res.json({ pkgVersions: ensureType<PkgVersionInfoMeta[]>(pkgVersions) });
}

export async function updatePkgVersion(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const pkgId = req.params.pkgId;
  const version = req.body.version;
  const branchId = req.body.branchId;
  const rawPkgVersion = req.body.pkg ?? {};
  // Note: The only thing users can modify from API is "tags" and "description" at the moment
  const toMerge = _.pick(rawPkgVersion, ["tags", "description"]);
  const pkgVersion = await mgr.updatePkgVersion(
    pkgId,
    version,
    branchId,
    toMerge
  );
  res.json({ pkg: pkgVersion });
}

function getFormattedStyleConfig(
  opts: RequiredSubKeys<Partial<ExportOpts>, "targetEnv">
) {
  const sc = exportStyleConfig(opts);
  const formattedRules = Prettier.format(sc.defaultStyleCssRules, {
    parser: "css",
  });
  sc.defaultStyleCssRules = formattedRules;
  return sc;
}

export async function revertToVersion(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const { branchId, pkgId, version } = req.body as {
    branchId: BranchId | undefined;
    pkgId: string;
    version: string;
  };
  assert(
    (await mgr.getPkgByProjectId(projectId))?.id === pkgId,
    () => `projectId doesn't match pkgId`
  );

  const latestRev = await mgr.getLatestProjectRev(projectId, { branchId });

  const pkgVersion = await mgr.getPkgVersion(pkgId, version, undefined, {
    branchId,
  });

  const bundler = new Bundler();
  const projectDep = await unbundlePkgVersion(mgr, bundler, pkgVersion);
  const data = bundler.bundle(
    projectDep.site,
    pkgVersion.id,
    await getLastBundleVersion()
  );

  const project = await mgr.getProjectById(projectId);
  req.promLabels.projectId = projectId;
  userAnalytics(req).track({
    event: "Revert project to version",
    properties: {
      projectId: project.id,
      projectName: project.name,
      branchId,
      version,
    },
  });

  const rev = await mgr.saveProjectRev({
    projectId,
    revisionNum: latestRev.revision + 1,
    data: JSON.stringify(data),
    seqIdAssign: undefined,
    branchId,
  });

  // Update commit graph
  await mgr.maybeUpdateCommitGraphForProject(projectId, (dag) => {
    dag.branches[branchId ?? MainBranchId] = pkgVersion.id;
  });

  res.json({ rev: _.omit(rev, "data") });

  // We resolve the transaction first before we broadcast the new updates
  // to other players
  await req.resolveTransaction();

  // Broadcast to the new project revision to all listeners
  await broadcastProjectsMessage({
    room: `projects/${projectId}`,
    type: "update",
    message: { projectId: projectId, revisionNum: rev.revision },
  });
}

export async function genStyleConfig(req: Request, res: Response) {
  res.json(
    getFormattedStyleConfig({
      targetEnv: "codegen",
      stylesOpts: req.body,
    })
  );
}

/**
 * Resolves a single project
 * Pre-condition: We assume the dependency tree is internally consistent,
 * so `conflicts` will always be empty
 */
async function doResolveSync(
  userMgr: DbMgr,
  superMgr: DbMgr,
  bundler: Bundler,
  projectId: string,
  branchName: string | undefined,
  versionRangeOrTag: string,
  componentIdOrNames: readonly string[] | undefined,
  recursive?: boolean,
  maybeProjectApiToken?: string
): Promise<VersionResolution> {
  const projectApiToken = await userMgr.validateOrGetProjectApiToken(
    projectId,
    maybeProjectApiToken
  );

  // Currently, just supporting getting the "latest" for branches
  if (branchName) {
    if (versionRangeOrTag === "latest") {
      versionRangeOrTag = branchName === "main" ? "latest" : branchName;
    }
  }

  const { version, site } =
    await superMgr.tryGetPkgVersionByProjectVersionOrTag(
      bundler,
      projectId,
      versionRangeOrTag
    );

  const result: VersionResolution = {
    projects: [],
    dependencies: [],
    conflicts: [],
  };
  const getMeta = async (
    metaProjectId: string,
    metaProjectApiToken: string,
    metaVersion: string,
    metaProjectName: string,
    metaSite: Site
  ) => {
    const meta: ProjectVersionMeta = {
      projectId: metaProjectId,
      projectApiToken: metaProjectApiToken,
      version: metaVersion,
      projectName: metaProjectName,
      componentIds: localComponents(metaSite)
        .filter((c) => isPlasmicComponent(c))
        .map((c) => c.uuid),
      iconIds: localIcons(metaSite).map((i) => i.uuid),
      dependencies: {},
    };
    const depToVersion: Dict<string> = {};
    for (const d of metaSite.projectDependencies) {
      const pkg = await superMgr.getPkgById(d.pkgId);
      const apiToken = await superMgr.validateOrGetProjectApiToken(
        pkg.projectId
      );
      depToVersion[pkg.projectId] = d.version;
      if (recursive) {
        result.dependencies.push(
          await getMeta(pkg.projectId, apiToken, d.version, pkg.name, d.site)
        );
      }
    }
    meta.dependencies = depToVersion;
    return meta;
  };

  // Add top-level project
  const project = await superMgr.getProjectById(projectId);
  result.projects.push(
    await getMeta(projectId, projectApiToken, version, project.name, site)
  );

  // By default we return all components/icons
  // If we want to apply a filter, start with specified components
  //  and crawl references
  if (componentIdOrNames) {
    const components = new Set<Component>();
    site.components
      .filter(
        (c) =>
          isPlasmicComponent(c) &&
          (componentIdOrNames.includes(c.uuid) ||
            componentIdOrNames.includes(c.name))
      )
      .forEach((root) => {
        components.add(root);
        componentToDeepReferenced(root).forEach((c) => components.add(c));
      });
    const icons = extractUsedIconAssetsForComponents(
      site,
      Array.from(components)
    );
    // Filter out non-referenced components/icons
    const allowedComponentIds = Array.from(components).map((c) => c.uuid);
    const allowedIconIds = Array.from(icons).map((i) => i.uuid);
    const filterFn = (p: ProjectVersionMeta) => {
      return {
        ...p,
        componentIds: p.componentIds.filter((c) =>
          allowedComponentIds.includes(c)
        ),
        iconIds: p.iconIds.filter((c) => allowedIconIds.includes(c)),
      };
    };
    result.projects = result.projects.map(filterFn);
    result.dependencies = result.dependencies.map(filterFn);
    result.conflicts = result.conflicts.map(filterFn);
  }

  return result;
}

function doGenIcons(site: Site, iconIds?: string[]) {
  //If iconIds is empty/not-specified, return everything
  const iconAssets = localIcons(site)
    .filter((x) => !iconIds || iconIds.includes(x.uuid))
    .map((x) => {
      const output = exportIconAsset(x);
      output.module = Prettier.format(output.module, { parser: "typescript" });
      return output;
    });
  return iconAssets;
}

export async function resolveSync(req: Request, res: Response) {
  // Resolve performs its own auth checks using the project API tokens inside
  // body.projects.
  const umgr = userDbMgr(req);
  const smgr = superDbMgr(req);
  const { projects: projectParams, recursive }: ResolveSyncRequest = req.body;
  const metas: VersionResolution[] = await Promise.all(
    projectParams.map((p) =>
      doResolveSync(
        umgr,
        smgr,
        req.bundler,
        p.projectId,
        p.branchName,
        p.versionRange,
        p.componentIdOrNames,
        recursive,
        p.projectApiToken
      )
    )
  );
  const projects = metas.flatMap((m) => m.projects);
  const dependencies = metas.flatMap((m) => m.dependencies);
  const conflicts = metas.flatMap((m) => m.conflicts);
  res.json({ projects, dependencies, conflicts });
}

export async function requiredPackages(req: Request, res: Response) {
  res.json(requiredPackageVersions);
}

const _latestCodegenVersion = "0.0.1";
export async function latestCodegenVersion(req: Request, res: Response) {
  res.json(_latestCodegenVersion);
}

export async function genCode(req: Request, res: Response) {
  const mgr = userDbMgr(req);

  const scheme: "plain" | "blackbox" =
    req.query["export"] === "true" ? "plain" : "blackbox";

  if (req.body.cliVersion) {
    // This is an obsolete check, so ask client to upgrade
    userAnalytics(req).track({
      event: "Stale codegen",
      properties: {
        cliVersion: req.body.cliVersion,
        requiredCliVersion: requiredPackageVersions["@plasmicapp/cli"],
        projectId: req.params.projectId,
      },
    });
    throw new StaleCliError(
      `Your version of @plasmicapp/cli is out of date.  Please upgrade to the latest version.`
    );
  }
  const platform =
    req.body.platform === "nextjs" || req.body.platform === "gatsby"
      ? req.body.platform
      : "react";
  const platformOptions = req.body.platformOptions || {};
  const project = await mgr.getProjectById(req.params.projectId);
  req.promLabels.projectId = project.id;
  const exportOpts: ExportOpts = {
    platform,
    platformOptions,
    lang: "ts",
    relPathFromImplToManagedDir: ".",
    relPathFromManagedToImplDir: ".",
    forceAllProps: false,
    forceRootDisabled: false,
    imageOpts: req.body.imageOpts ?? { scheme: "inlined" },
    stylesOpts: req.body.stylesOpts ?? { scheme: "css" },
    codeOpts: req.body.codeOpts ?? { reactRuntime: "classic" },
    fontOpts: req.body.fontOpts ?? { scheme: "import" },
    codeComponentStubs: false,
    skinnyReactWeb: false,
    skinny: false,
    importHostFromReactWeb: true,
    targetEnv: "codegen",
    ...(req.body.i18nOpts?.keyScheme && {
      localization: {
        keyScheme: req.body.i18nOpts?.keyScheme ?? "content",
        tagPrefix: req.body.i18nOpts?.tagPrefix,
      },
    }),
    hostLessComponentsConfig: "package",
    wrapPagesWithGlobalContexts: req.body.wrapPagesWithGlobalContexts,
    useComponentSubstitutionApi: false,
    useGlobalVariantsSubstitutionApi: false,
    useCustomFunctionsStub: false,
  };

  const branchName = req.query.branch as string;

  const resolvedVersion =
    req.body.version === "latest" && req.query.branchName
      ? branchName === "main"
        ? "latest"
        : branchName
      : req.body.version;

  console.log("Performing cli codegen for", project.id);
  const { output, checksums } = await withSpan("cli-codegen", async () =>
    req.workerpool.exec("codegen", [
      {
        scheme,
        connectionOptions: getConnection().options,
        projectId: project.id,
        exportOpts: exportOpts,
        componentIdOrNames: req.body.componentIdOrNames,
        maybeVersionOrTag: resolvedVersion,
        existingChecksums: req.body.checksums,
        indirect: !!req.body.indirect,
      },
    ])
  );

  const metadata = parseMetadata(req.body.metadata);

  const guessedUserId = hasUser(req)
    ? undefined
    : ensure(project.createdById, "Unexpected nullish project.createdById");
  userAnalytics(req, guessedUserId).track({
    event: "Codegen",
    properties: {
      projectId: project.id,
      projectName: project.name,
      numComponents: output.components.length,
      ...exportOpts,
      ...metadata,
    },
  });
  res.json({
    ...output,
    // convert the nameInIdToUuid from map to string array.
    components: output.components.map((bundle) => ({
      ...bundle,
      ...(bundle.scheme === "blackbox"
        ? { nameInIdToUuid: [...Object.entries(bundle.nameInIdToUuid)] }
        : undefined),
    })),
    checksums,
  });
}

export async function genStyleTokens(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const branchName = req.query.branchName;
  const resolvedVersion =
    req.body.versionRange === "latest" && req.query.branchName
      ? branchName === "main"
        ? "latest"
        : branchName
      : req.body.versionRange;
  const { site } = await mgr.tryGetPkgVersionByProjectVersionOrTag(
    req.bundler,
    projectId,
    resolvedVersion
  );
  req.promLabels.projectId = projectId;

  res.json(exportStyleTokens(projectId, site));
}

export async function genIcons(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const branchName = req.query.branchName;
  const resolvedVersion =
    req.body.versionRange === "latest" && req.query.branchName
      ? branchName === "main"
        ? "latest"
        : branchName
      : req.body.versionRange;
  const { version, site } = await mgr.tryGetPkgVersionByProjectVersionOrTag(
    req.bundler,
    projectId,
    resolvedVersion
  );
  req.promLabels.projectId = projectId;

  const iconAssets = doGenIcons(site, req.body.iconIds);
  res.json({ version, icons: iconAssets });
}

export async function fmtCode(req: Request, res: Response) {
  res.json({
    formatted: Prettier.format(req.body.code, { parser: req.body.parser }),
  });
}

export async function getProjectSyncMetadata(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const revision = req.body.revision;
  const projectSyncMetadata = await mgr.getProjectSyncMetadata(
    projectId,
    revision
  );
  req.promLabels.projectId = projectId;
  res.json(projectSyncMetadata.data);
}

async function getLatestRevisionSynced(
  mgr: DbMgr,
  projectId: string
): Promise<number> {
  // Revision number starts from 1
  return (await mgr.tryGetLatestRevisionSynced(projectId))?.revision || 0;
}

// Security model - anyone with view permission can trigger publishProject.
// If current user has edit permission, we share the edit permission with
// current user.
export async function publishCodeSandbox(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  await mgr.checkProjectPerms(
    projectId,
    "editor",
    "create or update sandbox",
    false,
    "Please make sure you have edit access to the Plasmic project before trying again."
  );
  req.promLabels.projectId = projectId;
  const token = getCodesandboxToken();
  const project = await mgr.getProjectById(projectId);
  const sandboxInfo: Partial<CodeSandboxInfo> = req.body;
  const scheme =
    maybes(sandboxInfo)((x) => x.code)((x) => x.scheme)() || "blackbox";

  // Create the sandbox if one doesn't exist
  const sandboxId =
    sandboxInfo.id ?? (await createNewSandbox(project.name, token));
  const existingSandbox = (await getSandbox(token, sandboxId)) as ISandbox;
  const version = getVersionTxt(existingSandbox);
  const codesandboxOpts = getCodesandboxOpts(version);

  const resolution: VersionResolution = await doResolveSync(
    mgr,
    mgr,
    req.bundler,
    projectId,
    undefined,
    semver.latestTag,
    undefined,
    true
  );
  // there should be no conflicts when we resolve from a single top-level project
  assert(
    resolution.conflicts.length === 0,
    `${resolution.conflicts.length} conflicts`
  );

  // Create a new sandbox if not specified
  let totalComponents = 0;
  const projectMetas = [
    ...resolution.projects,
    ...resolution.dependencies,
  ].reverse();
  for (const projectMeta of projectMetas) {
    const currProject = await mgr.getProjectById(projectMeta.projectId);
    const { output, site } = await req.workerpool.exec("codegen", [
      {
        scheme: "blackbox",
        connectionOptions: getConnection().options,
        projectId: currProject.id,
        exportOpts: codesandboxOpts.codegenOpts,
        componentIdOrNames: projectMeta.componentIds,
        maybeVersionOrTag: projectMeta.version,
        indirect: currProject.id !== projectId,
      },
    ]);
    totalComponents += output.components.length;

    const iconAssets = doGenIcons(site, projectMeta.iconIds);

    // get or create sandbox
    await updateSandbox(
      site,
      token,
      sandboxId,
      codesandboxOpts,
      {
        ...output,
        iconAssets,
        styleConfig: getFormattedStyleConfig({
          targetEnv: codesandboxOpts.codegenOpts.targetEnv,
          stylesOpts: codesandboxOpts.codegenOpts.stylesOpts,
        }),
      },
      scheme
    );
  }

  // If the sandboxId hasn't been saved in the project yet
  if (!sandboxInfo.id) {
    // save new sandboxId
    const codeSandboxInfos = [
      ...(project.codeSandboxInfos || []),
      {
        id: sandboxId,
        code: {
          lang: "ts",
          scheme: scheme,
        },
      } as CodeSandboxInfo,
    ];
    await mgr.updateProject({ id: project.id, codeSandboxInfos });
    // Send an invite to all users with editor permission.
    const perms = await mgr.getPermissionsForProject(project.id);
    for (const perm of perms) {
      if (accessLevelRank(perm.accessLevel) >= accessLevelRank("editor")) {
        const email = perm.user?.email || perm.email;
        if (email) {
          await shareSandbox(token, sandboxId, email, "WRITE_CODE", true);
        }
      }
    }
    if (project.createdById) {
      const creator = await mgr.tryGetUserById(project.createdById);
      if (creator?.email) {
        await shareSandbox(token, sandboxId, creator.email, "WRITE_CODE", true);
      }
    }
  }
  userAnalytics(req).track({
    event: "Codesandbox codegen",
    properties: {
      projectId: project.id,
      projectName: project.name,
      numComponents: totalComponents,
      scheme,
      sandboxId,
    },
  });
  res.json({ id: sandboxId });
}

export async function shareCodeSandbox(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  await mgr.checkProjectPerms(
    req.params.projectId,
    "editor",
    "create or update sandbox",
    false,
    "Please make sure you have edit access to the Plasmic project before trying again."
  );
  req.promLabels.projectId = req.params.projectId;
  await mgr.getProjectById(req.params.projectId);
  await shareSandbox(
    getCodesandboxToken(),
    req.body.sandboxId,
    req.body.email,
    "WRITE_CODE",
    false
  );
  res.json({});
}

export async function detachCodeSandbox(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  await mgr.checkProjectPerms(
    req.params.projectId,
    "editor",
    "create or update sandbox",
    false,
    "Please make sure you have edit access to the Plasmic project before trying again."
  );
  req.promLabels.projectId = req.params.projectId;
  const project = await mgr.getProjectById(req.params.projectId);
  const codeSandboxInfos = (project.codeSandboxInfos || []).filter(
    (x) => x.id !== req.body.sandboxId
  );
  await mgr.updateProject({
    id: req.params.projectId,
    codeSandboxInfos,
  });
  res.json({});
}

export async function getProjectMeta(req: Request, res: Response) {
  const projectId = req.params.projectId;
  const mgr = userDbMgr(req);
  await mgr.checkProjectPerms(projectId, "viewer", "View project meta", false);
  res.json(await makeProjectMeta(mgr, projectId));
}

async function makeProjectMeta(mgr: DbMgr, projectId: string) {
  const project = await mgr.getProjectById(projectId);
  const pkg = await mgr.getPkgByProjectId(projectId);
  const pkgVersion = pkg
    ? await mgr.getPkgVersion(pkg.id, undefined)
    : undefined;
  const allVersions = pkg ? await mgr.listPkgVersions(pkg.id) : [];
  const usersById = mkIdMap(
    await mgr.getUsersById(
      uniq(withoutNils(allVersions.map((v) => v.createdById)))
    )
  );
  return {
    id: project.id,
    name: project.name,
    workspaceId: project.workspaceId,
    hostUrl: project.hostUrl,
    lastPublishedVersion: pkgVersion?.version,
    publishedVersions: allVersions.map((v) => ({
      version: v.version,
      description: v.description,
      createdAt: v.createdAt.toISOString(),
      createdBy: maybe(v.createdById, (x) => usersById.get(x)?.email),
      tags: v.tags,
    })),
  };
}

export async function updateProjectMeta(req: Request, res: Response) {
  const projectId = req.params.projectId;
  const mgr = userDbMgr(req);
  console.log("Updating project hostUrl", projectId, req.body.hostUrl);
  await mgr.updateProject({
    id: projectId,
    ...(req.body.hostUrl ? { hostUrl: req.body.hostUrl } : {}),
    ...(req.body.workspaceId ? { workspaceId: req.body.workspaceId } : {}),
    ...(req.body.name ? { name: req.body.name } : {}),
  });
  res.json(await makeProjectMeta(mgr, projectId));
}

export async function updateProjectData(req: Request, res: Response) {
  const dbMgr = userDbMgr(req);
  const suMgr = superDbMgr(req);
  const projectId = req.params.projectId;
  const latestRev = await dbMgr.getLatestProjectRev(projectId);
  const oldBundle = await getMigratedBundle(latestRev);
  const bundler = new Bundler();
  const data = req.body as UpdateProjectReq;
  // Need to use superuser because our API token set probably only has access to leaf project and not dependencies
  const site = ensureKnownSite(
    (await unbundleSite(bundler, oldBundle, suMgr, latestRev)).siteOrProjectDep
  );

  const warnings: { message: string }[] = [];

  type ComponentSummary = {
    uuid: string;
    name: string;
    path: string | undefined;
  };
  const result: {
    newComponents: ComponentSummary[];
    regeneratedSecretApiToken?: string;
  } = {
    newComponents: [],
  };

  const upsertComponent = (compReq: NewComponentReq, allowUpdate: boolean) => {
    const tplMgr = new TplMgr({ site });

    // We match with existing component either by normalized name, path, or UUID.
    const existing = site.components.find(
      (c) =>
        toClassName(c.name) === maybe(compReq.name, toClassName) ||
        (compReq.path && c.pageMeta?.path === compReq.path) ||
        (compReq.byUuid && c.uuid === compReq.byUuid)
    );
    if (existing && !allowUpdate) {
      throw new BadRequestError(
        `Attempted to insert a new component called ${compReq.name} and path ${compReq.path} when an existing component with the same name or path already exists`
      );
    }

    let component: Component;

    if (existing) {
      // Leave existing component alone; only update the tplTree.
      component = existing;
    } else {
      const name = tplMgr.getUniqueComponentName(compReq.name);
      const cloneFrom = compReq.cloneFrom;
      if (cloneFrom) {
        const srcComponent = strictFind(site.components, (c) =>
          "uuid" in cloneFrom
            ? c.uuid === cloneFrom.uuid
            : c.name === cloneFrom.name
        );
        ({ component } = tplMgr.cloneComponent(srcComponent, name, true));
      } else {
        component = tplMgr.addComponent({
          type: compReq.path ? ComponentType.Page : ComponentType.Plain,
          name: name,
        });
      }
      if (compReq.path) {
        const path = tplMgr.getUniquePagePath(compReq.path);
        ensure(
          component.pageMeta,
          "Unexpected nullish component.pageMeta"
        ).path = path;
      }
    }

    // TODO: check for cyclic refs and other possible errors
    const maybeError = elementSchemaToTpl(site, component, compReq.body, {
      codeComponentsOnly: false,
    });

    if (maybeError.result.isError) {
      throw new BadRequestError(maybeError.result.error.message);
    }

    const { tpl, warnings: componentWarnings } = maybeError.result.value;
    componentWarnings.forEach((err) =>
      warnings.push({
        message: err.message + (err.description ? "\n" + err.description : ""),
      })
    );

    component.tplTree = tpl;
    tplMgr.ensureSubtreeCorrectlyNamed(component, component.tplTree);

    if (!allowUpdate) {
      result.newComponents.push({
        uuid: component.uuid,
        name: component.name,
        path: component.pageMeta?.path,
      });
    }
  };

  if (data.newComponents && data.newComponents.length > 0) {
    console.log(
      "Update project data: Creating components " +
        data.newComponents.map((c) => c.name).join(", ")
    );
    data.newComponents.forEach((c) => {
      upsertComponent(c, false);
    });
  }

  if (data.updateComponents && data.updateComponents.length > 0) {
    console.log(
      "Update project data: Updating components " +
        data.updateComponents.map((c) => c.name).join(", ")
    );
    data.updateComponents.forEach((c) => {
      upsertComponent(c, true);
    });
  }

  if (data.tokens && data.tokens.length > 0) {
    console.log(
      "Update project data: Updating tokens " +
        data.tokens.map((c) => c.name).join(", ")
    );
    addOrUpsertTokens(site, data.tokens);
  } else {
    console.log(
      `Update project data: no tokens to update (body.tokens = ${data.tokens})`
    );
  }

  if (data.regenerateSecretApiToken) {
    const secretApiToken = generateSomeApiToken();
    await dbMgr.updateProject({
      id: req.params.projectId,
      secretApiToken: secretApiToken,
    });
    result.regeneratedSecretApiToken = secretApiToken;
  }

  const newBundle = bundler.bundle(site, latestRev.id, oldBundle.version);

  assert(
    isExpectedBundleVersion(newBundle, await getLastBundleVersion()),
    "Unexpected bundle version " + newBundle.version
  );
  checkExistingReferences(newBundle);
  checkBundleFields(newBundle);
  checkRefsInBundle(newBundle);
  assertSiteInvariants(site);
  // Maybe also assert observable-model invariants?
  // assertObservabeModelInvariants(site, bundler, projectId);

  const existingProjectAssign = await dbMgr.tryGetSeqAssignment(projectId);

  const project = await dbMgr.getProjectById(projectId);

  const rev = await dbMgr.saveProjectRev({
    projectId: projectId,
    data: JSON.stringify(newBundle),
    revisionNum: latestRev.revision + 1,
    seqIdAssign: undefined,
  });

  userAnalytics(req).track({
    event: "Update project",
    properties: {
      projectId: projectId,
      projectName: project.name,
      revision: rev.revision,
    },
  });

  await dbMgr.clearPartialRevisionsCacheForProject(projectId);

  if (warnings.length > 0) {
    console.log(
      "Update project data - Warnings:\n",
      JSON.stringify(warnings, undefined, 2)
    );
  }

  res.json(warnings.length > 0 ? { warnings, result } : { result });

  await req.resolveTransaction();

  // Broadcast to the new project revision to all listeners
  await broadcastProjectsMessage({
    room: `projects/${project.id}`,
    type: "update",
    message: { projectId: project.id, revisionNum: rev.revision },
  });
}

export async function listProjectVersionsWithoutData(
  req: Request,
  res: Response
) {
  const mgr = userDbMgr(req);
  const projectId = req.params.projectId;
  const pkg = await mgr.getPkgByProjectId(projectId);
  if (!pkg) {
    throw new NotFoundError("Project has no published version");
  }
  const pkgVersions = await mgr.listPkgVersions(pkg?.id, {
    includeData: false,
  });
  res.json({ versions: pkgVersions });
}

export async function getCommentsForProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { projectId, branchId } = parseProjectBranchId(
    req.params.projectBranchId
  );
  const comments = await mgr.getCommentsForProject({ projectId, branchId });
  const reactions = await mgr.getReactionsForComments(comments);
  const selfNotificationSettings = req.user
    ? await mgr.tryGetNotificationSettings(req.user.id, brand(projectId))
    : undefined;
  res.json(
    ensureType<GetCommentsResponse>({
      comments,
      reactions,
      selfNotificationSettings,
    })
  );
}

export async function updateNotificationSettings(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { projectId, branchId } = parseProjectBranchId(
    req.params.projectBranchId
  );
  const settings: ApiNotificationSettings = req.body;
  await mgr.updateNotificationSettings(
    getUser(req).id,
    brand(projectId),
    settings
  );
  res.json({});
}

export async function postCommentInProject(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const author = getUser(req);
  const { projectId, branchId } = parseProjectBranchId(
    req.params.projectBranchId
  );
  const { data } = uncheckedCast<PostCommentRequest>(req.body);
  await mgr.postCommentInProject({ projectId, branchId }, data);

  // TODO: move side effects to somewhere else
  const notifySubscribers = async () => {
    const project = await mgr.getProjectById(projectId as ProjectId);
    const perms = await mgr.getPermissionsForProject(projectId);
    const mates = await mgr.getUsersById(
      uniq(
        withoutNils(
          without(
            [project.createdById, ...perms.map((p) => p.userId)],
            author.id
          )
        )
      )
    );
    const allComments = await mgr.getCommentsForProject({
      projectId,
      branchId,
    });
    const commentsByThread = xGroupBy(
      allComments,
      (comment) => comment.data.threadId
    );
    for (const mate of mates) {
      const notificationSettings = await mgr.tryGetNotificationSettings(
        mate.id,
        brand(projectId)
      );
      const notifyAbout = notificationSettings?.notifyAbout ?? "all";
      const isMentionOrReply = commentsByThread
        .get(data.threadId)
        ?.some((c) => c.createdById === mate.id);
      if (
        notifyAbout === "all" ||
        (notifyAbout === "mentions-and-replies" && isMentionOrReply)
      ) {
        await req.mailer.sendMail({
          from: req.config.mailFrom,
          to: mate.email,
          bcc: req.config.mailBcc,
          subject: `New comments on ${project.name}`,
          html: `
<p><strong>${fullName(author)}</strong> replied to a comment on <strong>${
            project.name
          }</strong>:</p>

<pre style="font: inherit;">${escapeHTML(data.body)}</pre>

<p><a href="${createProjectUrl(
            req.config.host,
            projectId
          )}">Open project in Plasmic Studio</a> to reply or change notification settings</p>
`.trim(),
        });
      }
    }
  };

  void notifySubscribers();

  await broadcastProjectsMessage({
    room: `projects/${projectId}`,
    type: "commentsUpdate",
    message: {},
  });

  res.json(ensureType<PostCommentResponse>({}));
}

export async function addReactionToComment(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  const { data } = uncheckedCast<AddCommentReactionRequest>(req.body);
  await mgr.addCommentReaction(brand(req.params.commentId), data);
  res.json(ensureType<PostCommentResponse>({}));
}

export async function removeReactionFromComment(req: Request, res: Response) {
  const mgr = userDbMgr(req);
  await mgr.removeCommentReaction(brand(req.params.reactionId));
  res.json({});
}

let latestVersion: number | undefined = undefined;
export async function checkAndNofityHostlessVersion(dbMgr: DbMgr) {
  const currentVersion = await dbMgr.getHostlessVersion();
  if (latestVersion === undefined) {
    latestVersion = currentVersion.versionCount;
    return;
  }
  if (latestVersion !== currentVersion.versionCount) {
    latestVersion = currentVersion.versionCount;
    await broadcastProjectsMessage({
      room: null,
      type: "hostlessDataVersionUpdate",
      message: {
        hostlessDataVersion: currentVersion.versionCount,
      },
    });
  }
}
