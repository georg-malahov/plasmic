/** @format */

import { ensure, uncheckedCast } from "@/wab/common";
import { latestTag } from "@/wab/commons/semver";
import { encodeUriParams } from "@/wab/commons/urls";
import { DEVFLAGS } from "@/wab/devflags";
import {
  ArenaType,
  CmsDatabaseId,
  CmsRowId,
  CmsRowRevisionId,
  CmsTableId,
  MainBranchId,
} from "@/wab/shared/ApiSchema";
import { isArenaType } from "@/wab/shared/Arenas";
import { getPublicUrl } from "@/wab/urls";
import { History, Location, LocationDescriptor } from "history";
import L from "lodash";
import { compile, PathFunction } from "path-to-regexp";
import { match as Match, matchPath, useRouteMatch } from "react-router-dom";
import * as url from "url";

type XMatch<T> = Match<any> & {
  params: T;
};

export class R<
  T extends Record<keyof T, string | undefined | string[]> = object
> {
  private readonly pathFunction: PathFunction;

  constructor(public pattern: string, opts?: { noCompile?: boolean }) {
    // Some of our routes don't work with path-to-regexp, but they are all static routes,
    // so for those routes, we can just use a function that returns the pattern itself.
    // TODO: If we upgrade to path-to-regexp 6+, PathFunction is generic and we can plug in T.
    this.pathFunction = opts?.noCompile ? () => pattern : compile(pattern);
  }

  /**
   * Fill in parameters and an optional query
   * @param params
   * @param query
   */
  fill(params: T, query?: any): string {
    const base = this.pattern.startsWith("https://")
      ? this.pattern
      : this.pathFunction(params);
    const result = url.format({
      pathname: base,
      query: query,
    });
    return result;
  }
  parse(path: string = location.pathname, exact = true): XMatch<T> | null {
    // We use `any` here because react-router actually does support /:foo* and /:bar+ but this isn't reflected in the types.
    const match = matchPath<any>(path, {
      path: this.pattern,
      exact,
    });
    if (!match) {
      return null;
    }

    // React Router matchPath doesn't decode even though it encodes, so we manually decode here.
    const encodedParams: T = match.params;
    const decodedParams: T = Object.fromEntries(
      Object.entries(encodedParams).map(([k, v]) => [
        k,
        typeof v === "string" ? decodeURIComponent(v) : v,
      ])
    ) as unknown as T;
    return {
      ...match,
      params: decodedParams,
    };
  }
}

export class RouteSet {
  dashboard = new R("/");
  allProjects = new R("/projects");
  playground = new R("/playground");
  workspace = new R<{ workspaceId: string }>("/workspaces/:workspaceId");

  //
  // Analytics
  //
  teamAnalytics = new R<{ teamId: string }>("/teams/:teamId/analytics");
  orgAnalytics = new R<{ teamId: string }>("/orgs/:teamId/analytics");

  //
  // Content
  //

  contentRoot = new R<{ databaseId: string }>("/content/:databaseId");
  content = new R<{ databaseId: CmsDatabaseId; tableId: CmsTableId }>(
    "/content/:databaseId/:tableId"
  );
  contentEntry = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
  }>("/content/:databaseId/:tableId/:rowId");
  contentEntryRevisions = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
  }>("/content/:databaseId/:tableId/:rowId/revisions");
  contentEntryRevision = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
    revisionId: CmsRowRevisionId;
  }>("/content/:databaseId/:tableId/:rowId/revisions/:revisionId");

  //
  // Models
  //

  models = new R<{ databaseId: CmsDatabaseId }>("/models/:databaseId");
  model = new R<{ databaseId: CmsDatabaseId; tableId: CmsTableId }>(
    "/models/:databaseId/:tableId"
  );

  //
  // CMS
  //
  cmsRoot = new R<{ databaseId: CmsDatabaseId }>("/cms/:databaseId");
  cmsContentRoot = new R<{ databaseId: CmsDatabaseId }>(
    "/cms/:databaseId/content"
  );
  cmsModelContent = new R<{ databaseId: CmsDatabaseId; tableId: CmsTableId }>(
    "/cms/:databaseId/content/models/:tableId"
  );
  cmsEntry = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
  }>("/cms/:databaseId/content/models/:tableId/entries/:rowId");
  cmsEntryRevisions = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
  }>("/cms/:databaseId/content/models/:tableId/entries/:rowId/revisions");
  cmsEntryRevision = new R<{
    databaseId: CmsDatabaseId;
    tableId: CmsTableId;
    rowId: CmsRowId;
    revisionId: CmsRowRevisionId;
  }>(
    "/cms/:databaseId/content/models/:tableId/entries/:rowId/revisions/:revisionId"
  );
  cmsSchemaRoot = new R<{ databaseId: CmsDatabaseId }>(
    "/cms/:databaseId/schemas"
  );
  cmsModelSchema = new R<{ databaseId: CmsDatabaseId; tableId: CmsTableId }>(
    "/cms/:databaseId/schemas/:tableId"
  );
  cmsSettings = new R<{ databaseId: CmsDatabaseId }>(
    "/cms/:databaseId/settings"
  );

  team = new R<{ teamId: string }>("/teams/:teamId");
  org = new R<{ teamId: string }>("/orgs/:teamId");
  teamSettings = new R<{ teamId: string }>("/teams/:teamId/settings");
  orgSettings = new R<{ teamId: string }>("/orgs/:teamId/settings");
  settings = new R("/settings");
  project = new R<{ projectId: string }>("/projects/:projectId");
  projectSlug = new R<{ projectId: string; slug: string }>(
    "/projects/:projectId/-/:slug"
  );
  /** @deprecated */
  projectBranchArena = new R<{
    projectId: string;
    branchName: string;
    branchVersion: string;
    arenaType: string | undefined;
    arenaName: string | undefined;
  }>(
    `/projects/:projectId/branch/:branchName@:branchVersion/:arenaType?/:arenaName?`
  );
  projectPreview = new R<{ projectId: string; previewPath: string }>(
    "/projects/:projectId/preview/:previewPath*"
  );
  projectFullPreview = new R<{ previewPath: string; projectId: string }>(
    "/projects/:projectId/preview-full/:previewPath*"
  );
  projectDocs = new R<{ projectId: string }>("/projects/:projectId/docs");
  projectDocsComponents = new R<{
    projectId: string;
    codegenType: "loader" | "codegen";
  }>("/projects/:projectId/docs/:codegenType/components");
  projectDocsComponent = new R<{
    projectId: string;
    componentIdOrClassName: string;
    codegenType: "loader" | "codegen";
  }>(
    "/projects/:projectId/docs/:codegenType/component/:componentIdOrClassName"
  );
  projectDocsIcons = new R<{
    projectId: string;
    codegenType: "loader" | "codegen";
  }>("/projects/:projectId/docs/:codegenType/icons");
  projectDocsIcon = new R<{
    projectId: string;
    iconIdOrClassName: string;
    codegenType: "loader" | "codegen";
  }>("/projects/:projectId/docs/:codegenType/icon/:iconIdOrClassName");
  projectDocsCodegenType = new R<{
    projectId: string;
    codegenType: "loader" | "codegen";
  }>("/projects/:projectId/docs/:codegenType");
  starter = new R<{
    starterTag: string;
  }>("/starters/:starterTag");
  admin = new R("/admin");
  login = new R("/login");
  logout = new R("/logout");
  signup = new R("/signup");
  sso = new R("/sso");
  authorize = new R("/authorize");
  forgotPassword = new R("/forgot-password");
  resetPassword = new R("/reset-password");
  googleAuth = new R(`/api/v1/auth/google`);
  airtableAuth = new R(`/api/v1/auth/airtable`);
  googleSheetsAuth = new R(`/api/v1/auth/google-sheets`);
  register = new R("/register");
  plasmicInit = new R("/auth/plasmic-init/:initToken");
  currentUser = new R("/api/v1/auth/self");
  userSettings = new R("/self/settings");
  privacy = new R("https://www.plasmic.app/privacy", { noCompile: true });
  tos = new R("https://www.plasmic.app/tos", { noCompile: true });
  survey = new R("/survey");
  emailVerification = new R("/email-verification");
  teamCreation = new R("/team-creation");
  orgCreation = new R("/org-creation");
  githubCallback = new R("/github/callback");
  startShopifyAuth = new R("/auth/shopify");
  finishShopifyAuth = new R("/auth/shopify-callback");
  discourseConnectClient = new R("/auth/discourse-connect");
  webImporterSandbox = new R("/sandbox/web-importer");
  importProjectsFromProd = new R("/import-projects-from-prod");
}

export const UU = new RouteSet();

export const U: {
  [P in keyof typeof UU]: (typeof UU)[P] extends R<infer X>
    ? (x: X) => string
    : never;
} = uncheckedCast(
  L.mapValues(
    UU,
    <T extends Record<string, string | undefined>>(v: R<T>) =>
      (params: T) =>
        v.fill(params)
  )
);

const SEARCH_PARAM_BRANCH = "branch";
const SEARCH_PARAM_VERSION = "version";
const SEARCH_PARAM_ARENA_TYPE = "arena_type";
const SEARCH_PARAM_ARENA = "arena";

export interface ProjectLocationParams {
  projectId: string;
  slug: string | undefined;
  branchName: MainBranchId | string;
  branchVersion: typeof latestTag | string;
  arenaType: ArenaType | undefined;
  arenaUuidOrName: string | undefined;
}

export function parseProjectLocation(
  location: Location
): ProjectLocationParams | undefined {
  const searchParams = new URLSearchParams(location.search);
  const branchName = searchParams.get(SEARCH_PARAM_BRANCH) || MainBranchId;
  const branchVersion = searchParams.get(SEARCH_PARAM_VERSION) || latestTag;
  const arenaTypeString = searchParams.get(SEARCH_PARAM_ARENA_TYPE);
  const arenaType = isArenaType(arenaTypeString) ? arenaTypeString : undefined;
  const arenaUuidOrName = searchParams.get(SEARCH_PARAM_ARENA) || undefined;

  const matchProject = UU.project.parse(location.pathname);
  if (matchProject) {
    return {
      projectId: matchProject.params.projectId,
      slug: undefined,
      branchName,
      branchVersion,
      arenaType,
      arenaUuidOrName,
    };
  }

  const matchProjectSlug = UU.projectSlug.parse(location.pathname);
  if (matchProjectSlug) {
    return {
      projectId: matchProjectSlug.params.projectId,
      slug: matchProjectSlug.params.slug,
      branchName,
      branchVersion,
      arenaType,
      arenaUuidOrName,
    };
  }

  return undefined;
}

export function mkProjectLocation({
  projectId,
  slug,
  branchName,
  branchVersion,
  arenaType,
  arenaUuidOrName,
}: ProjectLocationParams): LocationDescriptor {
  const searchParams: [string, string][] = [];
  if (branchName !== MainBranchId) {
    searchParams.push([SEARCH_PARAM_BRANCH, branchName]);
  }
  if (branchVersion !== latestTag) {
    searchParams.push([SEARCH_PARAM_VERSION, branchVersion]);
  }
  if (arenaType) {
    searchParams.push([SEARCH_PARAM_ARENA_TYPE, arenaType]);
  }
  if (arenaUuidOrName) {
    searchParams.push([SEARCH_PARAM_ARENA, arenaUuidOrName]);
  }
  const search =
    searchParams.length === 0 ? undefined : "?" + encodeUriParams(searchParams);
  const pathname = slug
    ? UU.projectSlug.fill({
        projectId,
        slug,
      })
    : UU.project.fill({
        projectId,
      });

  return {
    pathname,
    search,
  };
}

export class Router {
  constructor(public history: History) {}
  routeTo(path: string) {
    if (path.startsWith("//") || path.startsWith("https:")) {
      document.location.href = path;
    }
    this.history.push(path);
  }
}

export function getRouteContinuation() {
  const nextPath = location.pathname;

  // Strip the ?origin= param from the continuation's query params.
  const parsedSearch = new URLSearchParams(location.search);
  parsedSearch.delete("origin");
  parsedSearch.delete("isProd");
  let mungedSearch = parsedSearch.toString();
  if (mungedSearch) {
    mungedSearch = "?" + mungedSearch;
  }

  const continueTo = nextPath + mungedSearch + location.hash;
  return continueTo;
}

export function getLoginRouteWithContinuation() {
  const continueTo = getRouteContinuation();
  return UU.login.fill({}, { continueTo });
}

export function getEmaiLVerificationRouteWithContinuation() {
  const continueTo = getRouteContinuation();
  return UU.emailVerification.fill({}, { continueTo });
}

export function isPlasmicPath(pathname: string) {
  if (!pathname.startsWith("/")) {
    const _url = new URL(pathname);
    if (_url.origin !== origin) {
      return false;
    }
    pathname = _url.pathname;
  } else {
    // Exclude search
    pathname = new URL(origin + pathname).pathname;
  }
  return Object.values(UU).some(
    (route) => route instanceof R && !!route.parse(pathname)
  );
}

export function isTopFrame(): boolean {
  return (
    window.origin === getPublicUrl() ||
    DEVFLAGS.topFrameUrls.includes(window.origin)
  );
}

export function ensureIsTopFrame() {
  ensure(isTopFrame(), "not in top frame");
}

export function isHostFrame() {
  return !isTopFrame();
}

export function ensureIsHostFrame() {
  ensure(isHostFrame(), "not in host frame");
}

export type RouteParams<X> = X extends R<infer T> ? T : unknown;
export function useRRouteMatch<T extends R<any>>(route: T) {
  return useRouteMatch<RouteParams<T>>(route.pattern);
}
