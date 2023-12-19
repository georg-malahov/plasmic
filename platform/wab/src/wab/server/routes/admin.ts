import { fetchUser, verifyUser } from "@/wab/codesandbox/api";
import {
  assert,
  ensure,
  ensureType,
  filterFalsy,
  uncheckedCast,
} from "@/wab/common";
import { sendInviteEmail, sendShareEmail } from "@/wab/server/emails/Emails";
import {
  PkgVersion,
  ProjectRevision,
  PromotionCode,
} from "@/wab/server/entities/Entities";
import "@/wab/server/extensions.ts";
import { updateSecrets } from "@/wab/server/secrets";
import {
  resetTutorialDb as doResetTutorialDb,
  TutorialType,
} from "@/wab/server/tutorialdb/tutorialdb-utils";
import { doLogin } from "@/wab/server/util/auth-util";
import { BadRequestError, NotFoundError } from "@/wab/shared/ApiErrors/errors";
import {
  AddToWhitelistRequest,
  ApiFeatureTier,
  DataSourceId,
  GetWhitelistResponse,
  InviteRequest,
  InviteResponse,
  ListFeatureTiersResponse,
  ListInviteRequestsResponse,
  ListUsersResponse,
  LoginResponse,
  PkgVersionId,
  ProjectId,
  RemoveWhitelistRequest,
  TeamId,
  TutorialDbId,
  UpdateSelfAdminModeRequest,
} from "@/wab/shared/ApiSchema";
import { Bundle } from "@/wab/shared/bundler";
import { DomainValidator } from "@/wab/shared/hosting";
import { createProjectUrl } from "@/wab/urls";
import { Request, Response } from "express-serve-static-core";
import L, { omit, uniq } from "lodash";
import { mkApiDataSource } from "./data-source";
import {
  mkApiAppAuthConfig,
  mkApiAppEndUserAccess,
  mkApiAppRole,
} from "./end-user";
import { doSafelyDeleteProject } from "./projects";
import { getUser, superDbMgr, userDbMgr } from "./util";

import { broadcastProjectsMessage } from "@/wab/server/socket-util";
import { checkAndResetTeamTrial } from "./team-plans";

export async function createUser(req: Request, res: Response) {
  throw new Error("NOT IMPLEMENTED");
  // const mgr = superDbMgr(req);
  // const user = await mgr.createUser(req.body);
  // res.json({ user });
}

export async function listUsers(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const users = await mgr.listAllUsers();
  res.json(ensureType<ListUsersResponse>({ users }));
}

export async function listAllFeatureTiers(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const tiers = await mgr.listAllFeatureTiers();
  res.json(ensureType<ListFeatureTiersResponse>({ tiers }));
}

export async function addFeatureTier(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const data = uncheckedCast<ApiFeatureTier>(req.body.data);
  await mgr.addFeatureTier(data);
  res.json({});
}

export async function changeTeamOwner(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const teamId = req.body.teamId;
  const newOwner = req.body.newOwner;

  await (teamId && newOwner && mgr.changeTeamOwner(teamId, newOwner));
  res.json({});
}

export async function upgradePersonalTeam(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const teamId = req.body.teamId;

  await (teamId && mgr.upgradePersonalTeam(teamId));
  res.json({});
}

export async function resetTeamTrial(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const teamId = req.body.teamId;
  await checkAndResetTeamTrial(teamId, mgr, req.devflags);
  res.json({});
}

export async function listTeams(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const userId = req.body.userId;

  const teams = await (userId ? mgr.listTeamsForUser(userId) : undefined);
  res.json({ teams });
}

export async function listProjects(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const ownerId = req.body.ownerId;
  const projects = await (ownerId
    ? mgr.listProjectsForUser(ownerId)
    : mgr.listAllProjects());
  res.json({ projects });
}

export async function deleteProjectAndRevisions(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { projectId } = req.body;

  if (await mgr.tryGetProjectById(projectId, true)) {
    const pkg = await mgr.getPkgByProjectId(projectId);
    if (pkg) {
      await mgr.getEntMgr().getRepository(PkgVersion).delete({
        pkgId: pkg.id,
      });
    }
    await mgr.getEntMgr().getRepository(ProjectRevision).delete({
      projectId,
    });
  }
  res.json({});
}

export async function deleteProject(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  await doSafelyDeleteProject(
    mgr,
    new DomainValidator(req.devflags.plasmicHostingSubdomainSuffix),
    req.body.id
  );
  res.json({});
}

export async function updateProjectOwner(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const project = await mgr.getProjectById(req.body.projectId);
  const user = await mgr.getUserByEmail(req.body.ownerEmail);

  await mgr.updateProjectOwner(project.id, user.id);
  res.json({});
}

export async function restoreProject(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const users = await mgr.restoreProject(req.body.id);
  res.json({});
}

export async function resetPassword(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const email = req.body.email;
  const user = await mgr.tryGetUserByEmail(email);
  if (user) {
    const resetSecret = await mgr.createResetPasswordForUser(user);
    res.json({ secret: resetSecret });
  } else {
    throw new NotFoundError("No user found.");
  }
}

export async function setPassword(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const email = req.body.email;
  const newPassword = req.body.newPassword;
  const user = await mgr.tryGetUserByEmail(email);
  if (user) {
    await mgr.updateUserPassword(user, newPassword, true);
    res.json({});
  } else {
    throw new NotFoundError("No user found.");
  }
}

export async function addToWhitelist(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const approvedRequests = await mgr.addToWhitelist(
    uncheckedCast<AddToWhitelistRequest>(req.body)
  );
  for (const approvedRequest of approvedRequests) {
    const project = await mgr.getProjectById(approvedRequest.projectId);
    await sendShareEmail(
      req,
      await mgr.getUserById(
        ensure(approvedRequest.createdById, () => `User not found`)
      ),
      approvedRequest.inviteeEmail,
      "project",
      project.name,
      createProjectUrl(req.config.host, project.id),
      !!(await mgr.tryGetUserByEmail(approvedRequest.inviteeEmail))
    );
  }
  res.json({});
}

export async function removeWhitelist(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  await mgr.removeWhitelist(uncheckedCast<RemoveWhitelistRequest>(req.body));
  res.json({});
}

export async function getWhitelist(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const entries = await mgr.getWhitelist();
  const emails = filterFalsy(entries.map((entry) => entry.email));
  const domains = filterFalsy(entries.map((entry) => entry.domain));
  res.json(ensureType<GetWhitelistResponse>({ emails, domains }));
}

export async function adminLoginAs(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const email = req.body.email;
  const user = ensure(
    await mgr.tryGetUserByEmail(email),
    () => `User not found`
  );
  await new Promise<void>((resolve, reject) => {
    doLogin(req, user, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
  console.log("admin logged in as", getUser(req).email);
  res.cookie("plasmic-observer", "true");
  res.json(ensureType<LoginResponse>({ status: true, user }));
}

export async function invite(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { emails } = uncheckedCast<InviteRequest>(req.body);
  const skippedEmails: string[] = [];
  for (const email of L.uniq(emails.map((e) => e.toLowerCase()))) {
    if (
      (await mgr.isUserWhitelisted(email, true)) ||
      (await mgr.tryGetUserByEmail(email))
    ) {
      skippedEmails.push(email);
    } else {
      await mgr.addToWhitelist({ email });
      await sendInviteEmail(req, email);
    }
  }
  res.json(ensureType<InviteResponse>({ skippedEmails }));
}

export async function listInviteRequests(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const requests = await mgr.listInviteRequests();
  res.json(ensureType<ListInviteRequestsResponse>({ requests }));
}

export async function getDevFlagOverrides(req: Request, res: Response) {
  const data = (await superDbMgr(req).tryGetDevFlagOverrides())?.data ?? "";
  res.json({ data });
}

export async function setDevFlagOverrides(req: Request, res: Response) {
  // Use userDbMgr so that data is stamped with the user's id
  await userDbMgr(req).setDevFlagOverrides(req.body.data);
  res.json({});
}

export async function getDevFlagVersions(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const versions = await mgr.getDevFlagVersions();
  res.json({ versions });
}

export async function updateCodeSandboxToken(req: Request, res: Response) {
  const newToken = req.body.token;
  // Make sure the new token works!  (If it doesn't, an error is thrown)
  try {
    const { token, user } = await verifyUser(newToken);
    const csUser = await fetchUser(token);
    updateSecrets({ codesandboxToken: token });
    res.json({ user, token });
  } catch (e) {
    res.json({ error: `${e}` });
  }
}

export async function cloneProject(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const projectId = req.body.projectId;
  const project = await mgr.cloneProject(projectId, req.bundler, {
    ownerId: ensure(req.user, () => "User not found").id,
    revisionNum: req.body.revisionNum,
  });

  // By default, turn off invite only for projects cloned this way
  await mgr.updateProject({ id: project.id, inviteOnly: true });
  res.json({ projectId: project.id });
}

export async function revertProjectRevision(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const projectId = req.body.projectId;
  const rev = req.body.revision;
  await mgr.revertProjectRev(projectId, rev);
  res.json({ projectId });
}

export async function getLatestProjectRevision(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const rev = await mgr.getLatestProjectRev(projectId);
  res.json({ rev });
}

export async function saveProjectRevisionData(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const projectId = req.params.projectId as ProjectId;
  const rev = await mgr.getLatestProjectRev(projectId);
  if (rev.revision !== req.body.revision) {
    throw new BadRequestError(
      `Revision has since been updated from ${req.body.revision} to ${rev.revision}`
    );
  }

  // Make sure it's valid JSON
  JSON.parse(req.body.data);

  const newRev = await mgr.saveProjectRev({
    projectId: projectId,
    data: req.body.data,
    revisionNum: rev.revision + 1,
    seqIdAssign: undefined,
  });
  await mgr.clearPartialRevisionsCacheForProject(projectId, undefined);
  res.json({ rev: omit(newRev, "data") });
  await req.resolveTransaction();
  await broadcastProjectsMessage({
    room: `projects/${projectId}`,
    type: "update",
    message: { projectId, revisionNum: newRev.revision },
  });
}

export async function getPkgVersion(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  let pkgVersion: PkgVersion;
  if (req.query.pkgVersionId) {
    pkgVersion = await mgr.getPkgVersionById(
      req.query.pkgVersionId as PkgVersionId
    );
  } else if (req.query.pkgId) {
    pkgVersion = await mgr.getPkgVersion(
      req.query.pkgId as string,
      req.query.version as string | undefined
    );
  } else {
    throw new BadRequestError("Must specify either PkgVersion ID or Pkg ID");
  }
  res.json({
    pkgVersion,
  });
}

export async function savePkgVersion(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const pkgVersionId = req.params.pkgVersionId;
  const data = req.body.data as string;
  const pkgVersion = await mgr.getPkgVersionById(pkgVersionId);
  await mgr.updatePkgVersion(pkgVersion.pkgId, pkgVersion.version, null, {
    model: data,
  });
  res.json({
    pkgVersion,
  });
}

export async function deactivateUser(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const email = req.body.email;
  const user = await mgr.tryGetUserByEmail(email);
  if (!user) {
    throw new Error("User not found");
  }
  await mgr.deleteUser(user, false);
  res.json({});
}

export async function upgradeTeam(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const {
    teamId,
    featureTierId,
    seats,
    billingFrequency,
    billingEmail,
    stripeCustomerId,
    stripeSubscriptionId,
  } = req.body;
  await mgr.sudoUpdateTeam({
    id: teamId,
    featureTierId,
    seats,
    billingFrequency,
    billingEmail,
    stripeCustomerId,
    stripeSubscriptionId,
  });
  res.json({});
}

export async function upsertSamlConfig(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { teamId, domain, entrypoint, issuer, cert } = req.body;
  const config = await mgr.upsertSamlConfig({
    teamId,
    domains: [domain],
    entrypoint,
    cert,
    issuer,
  });
  res.json(config);
}

export async function upsertSsoConfig(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { teamId, domain, provider, config } = req.body;
  const sso = await mgr.upsertSsoConfig({
    teamId,
    domains: [domain],
    ssoType: "oidc",
    config,
    provider,
  });
  res.json(sso);
}

export async function getSsoByTeam(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const teamId = req.query.teamId as TeamId;
  const sso = await mgr.getSsoConfigByTeam(teamId);
  res.json(sso ?? null);
}

export async function createTutorialDb(req: Request, res: Response) {
  console.log("Creating tutorialDB of type", req.body.type);
  const mgr = superDbMgr(req);
  const type = req.body.type as TutorialType;
  const result = await mgr.createTutorialDb(type);
  res.json({ id: result.id, ...result.info });
}

export async function resetTutorialDb(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const sourceId = req.body.sourceId as DataSourceId;
  const source = await mgr.getDataSourceById(sourceId);
  assert(source.source === "tutorialdb", "Can only reset tutorialdb");
  const tutorialDbId = source.credentials.tutorialDbId as TutorialDbId;
  const tutorialDb = await mgr.getTutorialDb(tutorialDbId);
  await doResetTutorialDb(tutorialDb.info);
  res.json({});
}

export async function getTeamByWhiteLabelName(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const team = await mgr.getTeamByWhiteLabelName(req.query.name as string);
  console.log("TEAM", req.query.name, team);
  res.json({ team: team });
}

export async function updateTeamWhiteLabelInfo(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const team = await mgr.getTeamById(req.body.id as TeamId);
  const team2 = await mgr.updateTeamWhiteLabelInfo(
    team.id,
    req.body.whiteLabelInfo
  );
  res.json({ team: team2 });
}

export async function updateTeamWhiteLabelName(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const team = await mgr.updateTeamWhiteLabelName(
    req.body.id as TeamId,
    req.body.whiteLabelName
  );
  res.json({ team: team });
}

export async function updateSelfAdminMode(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const disabled = uncheckedCast<UpdateSelfAdminModeRequest>(
    req.body
  ).adminModeDisabled;
  await mgr.updateAdminMode({
    id: getUser(req).id,
    disabled,
  });
  res.json({});
}

export async function createPromotionCode(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { id, message, expirationDate, trialDays } = req.body as PromotionCode;
  await mgr.createPromotionCode(id, message, trialDays, expirationDate);
  res.json({});
}

export async function getAppAuthMetrics(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { recency, threshold } = req.query;
  const metrics = await mgr.getAppAuthMetrics(
    recency ? parseInt(recency as string) : undefined,
    threshold ? parseInt(threshold as string) : undefined
  );
  res.json({ metrics });
}

// Describe app auth and used data sources in a project
export async function getProjectAppMeta(req: Request, res: Response) {
  const mgr = superDbMgr(req);
  const { projectId } = req.params;

  const rev = await mgr.getLatestProjectRev(projectId as string);
  const appAuthConfig = await mgr.getAppAuthConfig(projectId as string);
  const roles = await mgr.listAppRoles(projectId as string);
  const accesses = await mgr.listAppAccessRules(projectId as string);

  const bundle = JSON.parse(rev.data) as Bundle;

  const sourceIds: string[] = [];
  for (const inst of Object.values(bundle.map)) {
    if (inst.__type === "DataSourceOpExpr") {
      sourceIds.push(inst.sourceId);
    }
  }

  const dataSources = await Promise.all(
    uniq(sourceIds).map((id) => mgr.getDataSourceById(id))
  );

  const meta = {
    projectId,
    appAuthConfig: appAuthConfig
      ? mkApiAppAuthConfig(appAuthConfig)
      : undefined,
    roles: roles.map(mkApiAppRole),
    accesses: accesses.map(mkApiAppEndUserAccess),
    dataSources: dataSources.map((ds) => mkApiDataSource(ds, ds.createdById!)),
  };

  res.json(meta);
}
