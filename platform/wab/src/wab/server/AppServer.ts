// const origLog = console.error;
// console.error = (...args: any[]) => {
//   origLog(...args);
//   origLog(new Error().stack);
// };

// const origOn = (process as any).on;
// (process as any).on = function (...args) {
//   if (args[0].toLowerCase() === "unhandledrejection") {
//     debugger;
//   }
//   return origOn.apply(this, args);
// };

import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import Analytics from "analytics-node";
import * as bodyParser from "body-parser";
import connectDatadog from "connect-datadog";
import cookieParser from "cookie-parser";
import cors from "cors";
import errorHandler from "errorhandler";
import express, { ErrorRequestHandler, RequestHandler } from "express";
import "express-async-errors";
// Exempt from prettier-plugin-organize-imports, which removes
// importing from "./extensions"
// organize-imports-ignore
import fileUpload from "express-fileupload";
import promMetrics from "express-prom-bundle";
import { NextFunction, Request, Response } from "express-serve-static-core";
import session from "express-session";
import * as lusca from "lusca";
import morgan from "morgan";
import passport from "passport";
import * as path from "path";
import { getConnection } from "typeorm";
import v8 from "v8";
import { mergeSane, mkShortId, safeCast, spawn } from "@/wab/common";
import { DEVFLAGS } from "@/wab/devflags";
// API keys and Passport configuration
import {
  AuthError,
  isApiError,
  NotFoundError,
  transformErrors,
} from "@/wab/shared/ApiErrors/errors";
import { Bundler } from "@/wab/shared/bundler";
import { Config } from "./config";
import { DbMgr, SUPER_USER } from "./db/DbMgr";
import { createMailer } from "./emails/Mailer";
import { ExpressSession } from "./entities/Entities";
import "./extensions";
import { setupPassport } from "./passport-cfg";
import { trackPostgresPool, WabPromStats } from "./promstats";
import * as adminRoutes from "./routes/admin";
import {
  getAnalyticsBillingInfoForTeam,
  getAnalyticsForProject,
  getAnalyticsForTeam,
  getAnalyticsProjectMeta,
} from "./routes/analytics";
import * as apiTokenRoutes from "./routes/apitokens";
import {
  getEndUserByToken,
  grantOauthToken,
  issueOauthCode,
  upsertEndUser,
} from "./routes/app-oauth";
import { getAppCtx } from "./routes/appctx";
import * as authRoutes from "./routes/auth";
import { apiAuth, shopifyAuthStart, shopifyCallback } from "./routes/auth";
import { bigCommerceGraphql } from "./routes/bigcommerce";
import {
  cachePublicCmsRead,
  countTable,
  getDatabase,
  publicCreateRows,
  publicDeleteRow,
  publicPublishRow,
  publicUpdateRow,
  queryTable,
  upsertDatabaseTables,
} from "./routes/cms";
import {
  cmsFileUpload,
  createDatabase,
  createRows,
  createTable,
  deleteDatabase,
  deleteRow,
  deleteTable,
  getCmsDatabaseAndSecretTokenById,
  getDatabaseMeta,
  getRow as getCmseRow,
  getRowRevision,
  listDatabases,
  listDatabasesMeta,
  listRowRevisions,
  listRows,
  updateDatabase,
  updateRow,
  updateTable,
  triggerTableWebhooks,
} from "./routes/cmse";
import {
  allowProjectToDataSource,
  createDataSource,
  deleteDataSource,
  executeDataSourceStudioOperationHandler,
  getDataSourceById,
  getDataSourceOperationId,
  listAirtableBases,
  listDataSources,
  testDataSourceConnection,
  updateDataSource,
} from "./routes/data-source";
import {
  getFakeBlurbs,
  getFakePlans,
  getFakePosts,
  getFakeTasks,
  getFakeTestimonials,
  getFakeTweets,
} from "./routes/demodata";
import {
  addDirectoryEndUsers,
  changeAppRolesOrder,
  createAccessRules,
  createDirectoryGroup,
  createEndUserDirectory,
  createRole,
  deleteAccessRule,
  deleteAppAccessRegister,
  deleteAppAuthConfig,
  deleteAppRole,
  deleteDirectory,
  deleteDirectoryGroup,
  disableAppAuth,
  getAppAuthConfig,
  getAppAuthPubConfig,
  getAppCurrentUserOpConfig,
  getAppCurrentUserProperties,
  getDirectoryUsers,
  getEndUserDirectory,
  getEndUserDirectoryApps,
  getInitialUserToViewAs,
  getUserRoleInApp,
  listAppAccessRegistries,
  listAppAccessRules,
  listAppUsers,
  listDirectoryGroups,
  listRoles,
  listTeamEndUserDirectories,
  removeEndUserFromDirectory,
  updateAccessRule,
  updateAppRole,
  updateDirectoryGroup,
  updateEndUserDirectory,
  updateEndUserGroups,
  upsertAppAuthConfig,
  upsertCurrentUserOpConfig,
} from "./routes/end-user";
import {
  addProjectRepository,
  connectGithubInstallations,
  deleteProjectRepository,
  detectOptionsFromDirectory,
  fireGitAction,
  getGitWorkflowJob,
  getLatestWorkflowRun,
  getProjectRepositories,
  githubBranches,
  githubData,
  setupExistingGithubRepo,
  setupNewGithubRepo,
} from "./routes/git";
import {
  addTrustedHost,
  deleteTrustedHost,
  getTrustedHostsForSelf,
} from "./routes/hosts";
import { uploadImage } from "./routes/image";
import {
  buildLatestLoaderAssets,
  buildLatestLoaderHtml,
  buildLatestLoaderReprV2,
  buildLatestLoaderReprV3,
  buildPublishedLoaderAssets,
  buildPublishedLoaderHtml,
  buildPublishedLoaderReprV2,
  buildPublishedLoaderReprV3,
  buildVersionedLoaderAssets,
  buildVersionedLoaderHtml,
  buildVersionedLoaderReprV2,
  buildVersionedLoaderReprV3,
  getHydrationScript,
  getHydrationScriptVersioned,
  getLoaderChunk,
  prefillPublishedLoader,
} from "./routes/loader";
import { genTranslatableStrings } from "./routes/localization";
import * as mailingListRoutes from "./routes/mailinglist";
import {
  discourseConnect,
  findFreeVars,
  getAppConfig,
  getClip,
  putClip,
} from "./routes/misc";
import {
  createProjectWebhook,
  deleteProjectWebhook,
  getProjectWebhookEvents,
  getProjectWebhooks,
  triggerProjectWebhook,
  updateProjectWebhook,
} from "./routes/project-webhooks";
import {
  addReactionToComment,
  changeProjectPermissions,
  checkAndNofityHostlessVersion,
  cloneProject,
  clonePublishedTemplate,
  createBranch,
  createPkgByProjectId,
  createProject,
  createProjectWithHostlessPackages,
  deleteBranch,
  deleteProject,
  detachCodeSandbox,
  fmtCode,
  genCode,
  genIcons,
  genStyleConfig,
  genStyleTokens,
  getCommentsForProject,
  getFullProjectData,
  getLatestBundleVersion,
  getLatestPlumePkg,
  getModelUpdates,
  getPkgByProjectId,
  getPkgVersion,
  getPkgVersionPublishStatus,
  getPlumePkg,
  getPlumePkgVersionStrings,
  getProjectMeta,
  getProjectRev,
  getProjectRevWithoutData,
  getProjectSyncMetadata,
  importProject,
  latestCodegenVersion,
  listBranchesForProject,
  listPkgVersionsWithoutData,
  listProjects,
  listProjectVersionsWithoutData,
  postCommentInProject,
  publishCodeSandbox,
  publishProject,
  removeReactionFromComment,
  removeSelfPerm,
  requiredPackages,
  resolveSync,
  revertToVersion,
  saveProjectRev,
  shareCodeSandbox,
  tryMergeBranch,
  updateBranch,
  updateHostUrl,
  updateNotificationSettings,
  updatePkgVersion,
  updateProject,
  updateProjectData,
  updateProjectMeta,
} from "./routes/projects";
import {
  executeDataSourceOperationHandler,
  executeDataSourceOperationHandlerInStudio,
} from "./routes/server-data";
import {
  emailWebhook,
  getProducts,
  probeCanAccessShopifyShop,
  proxyToShopify,
  publishShopifyPages,
  updateShopifyStorePassword,
} from "./routes/shopify";
import * as teamRoutes from "./routes/teams";
import { getUsersById } from "./routes/users";
import {
  adminOnly,
  adminOrDevelopmentEnvOnly,
  superDbMgr,
  withNext,
} from "./routes/util";
import {
  createWorkspace,
  deleteWorkspace,
  getPersonalWorkspace,
  getWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "./routes/workspaces";
import { getSegmentWriteKey } from "./secrets";
import { logError } from "./server-util";
import { ASYNC_TIMING } from "./timing-util";
import { TsSvc } from "./TsSvc";
import { doLogout } from "./util/auth-util";
import {
  pruneOldBundleBackupsCache,
  prunePartialRevCache,
} from "./util/pruneCache";
import { TypeormStore } from "./util/TypeormSessionStore";
import { createWorkerPool } from "./workers/pool";
import {
  createWhiteLabelUser,
  deleteWhiteLabelUser,
  getWhiteLabelUser,
  openJwt,
} from "./routes/whitelabel";
import { getPromotionCodeById } from "./routes/promo-code";
import { getDevFlagsMergedWithOverrides } from "./db/appconfig";
import { isCoreTeamEmail } from "@/wab/shared/devflag-utils";
import { addInternalRoutes, ROUTES_WITH_TIMING } from "./routes/custom-routes";
import { ensureDevFlags } from "./workers/worker-utils";

const hotShots = require("hot-shots");

const datadogMiddleware = connectDatadog({
  response_code: true,
  tags: ["app:my_app"],
  dogstatsd: new hotShots.StatsD("localhost", 8126),
});

const csrfFreeStaticRoutes = {
  "/api/v1/admin/user": true,
  "/api/v1/admin/resetPassword": true,
  "/api/v1/admin/delete-project": true,
  "/api/v1/admin/restore-project": true,
  "/api/v1/admin/login-as": true,
  "/api/v1/admin/invite": true,
  "/api/v1/admin/devflags": true,
  "/api/v1/admin/clone": true,
  "/api/v1/admin/deactivate-user": true,
  "/api/v1/admin/revert-project-revision": true,
  "/api/v1/bigcommerce/graphql": true,
  "/api/v1/mail/subscribe": true,
  "/api/v1/plume-pkg/versions": true,
  "/api/v1/localization/gen-texts": true,
  "/api/v1/hosting-hit": true,
  "/api/v1/socket/": true,
  "/api/v1/init-token/": true,
  "/api/v1/promo-code/": true,
  "/api/v1/projects/import": process.env.NODE_ENV !== "production",

  // csrf-free routes to the socket server routes, if socket server
  // is not running and the routes are mounted on this server
  "/api/v1/disconnect": true,
  "/api/v1/projects/broadcast": true,
  "/api/v1/cli/emit-token": true,
};

const isCsrfFreeRoute = (pathname: string) => {
  return (
    csrfFreeStaticRoutes[pathname] ||
    pathname.includes("/api/v1/clip/") ||
    pathname.includes("/code/") ||
    pathname.includes("/api/v1/loader/code") ||
    pathname.includes("/api/v1/loader/chunks") ||
    pathname.includes("/api/v1/shopify/publish") ||
    pathname.includes("/api/v1/shopify/webhooks/") ||
    pathname.includes("/jsbundle") ||
    pathname.includes("/api/v1/loader/") ||
    pathname.includes("/api/v1/server-data/") ||
    pathname.includes("/api/v1/wl/") ||
    pathname.includes("/api/v1/cms/") ||
    pathname.match("/api/v1/projects/[^/]+$") ||
    pathname.match("/api/v1/auth/saml/.*/consume") ||
    pathname.match("/api/v1/auth/sso/.*/consume") ||
    (pathname.includes("/api/v1/cmse/") &&
      process.env.NODE_ENV !== "production") ||
    pathname.includes("/api/v1/app-auth/user") ||
    pathname.includes("/api/v1/app-auth/userinfo") ||
    pathname.includes("/api/v1/app-auth/token")
  );
};

const ignoredErrorMessages = [
  "CSRF token mismatch",
  "Connection closed before response fulfilled",
  // This happens whenever the client disconnects first, and the
  // server hasn't finished the response yet and attempts to make
  // a typeorm query. Nothing we can do about that.
  "Query runner already released",
];

function shouldIgnoreErrorByMessage(message: string) {
  return ignoredErrorMessages.some((pattern) => message.includes(pattern));
}

function addSentry(app: express.Application, config: Config) {
  if (!config.sentryDSN) {
    return;
  }
  console.log("Initializing Sentry with DSN:", config.sentryDSN);
  Sentry.init({
    dsn: config.sentryDSN,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      // to trace all requests to the default router
      new Tracing.Integrations.Express({
        app,
      }),
    ],
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
    // We need beforeSend because errors don't necessarily make their way through the Express pipeline - they can be
    // thrown from anywhere, in Express or outside (or from random async event loop iterations).
    async beforeSend(event: Sentry.Event): Promise<Sentry.Event | null> {
      const msg = event.exception?.values?.[0].value;
      if (msg) {
        if (shouldIgnoreErrorByMessage(msg)) {
          return null;
        }
      }
      return event;
    },
  });
  app.use((req, _res, next) => {
    // Some routes get project ID as a path param (e.g.
    // /projects/:projectId/code/components) while others get it as query
    // (e.g. /loader/code/versioned?projectId=<>).
    const projectId = req.params.projectId ?? req.query.projectId;
    if (projectId) {
      Sentry.setTag("projectId", String(projectId));
    }
    next();
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Copied from @sentry: https://github.com/getsentry/sentry-javascript/blob/master/packages/node/src/handlers.ts
export function getStatusCodeFromResponse(error: any): number {
  const statusCode =
    error.status ||
    error.statusCode ||
    error.status_code ||
    (error.output && error.output.statusCode);
  return statusCode ? parseInt(statusCode as string, 10) : 500;
}

function addSentryError(app: express.Application, config: Config) {
  if (!config.sentryDSN) {
    return;
  }

  /** Returns true if response code is internal server error */
  const defaultShouldHandleError = (error: any): boolean => {
    const status = getStatusCodeFromResponse(transformErrors(error));
    return status >= 500;
  };

  const shouldHandleError = (error) => {
    if (shouldIgnoreErrorByMessage(error.message || "")) {
      return false;
    }
    if (error["request"]?.headers?.["user-agent"]?.startsWith("octokit")) {
      // Errors from Octokit (GitHub client) should always be logged,
      // even if status code < 500.
      return true;
    }
    return defaultShouldHandleError(error);
  };

  app.use(Sentry.Handlers.errorHandler({ shouldHandleError }));
}

export function addLoggingMiddleware(app: express.Application) {
  morgan.token("request-id", (req: Request) => req.id);
  morgan.token("user-email", (req: Request) => req.user?.email);
  // Remove metrics url to avoid spam
  app.use(
    morgan(
      `[:request-id] :remote-addr - :user-email [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" (:total-time[0]ms)`,
      {
        skip: (req, _) => {
          return req.originalUrl === "/metrics" || req.url === "/metrics";
        },
      }
    )
  );
}

function addMiddlewares(
  app: express.Application,
  name: string,
  config: Config,
  expressSessionMiddleware: express.RequestHandler,
  tsSvc: TsSvc | undefined,
  opts?: {
    skipSession?: boolean;
  }
) {
  const connectionPool = getConnection();

  addLoggingMiddleware(app);
  app.use(cookieParser());

  if (!opts?.skipSession) {
    app.use(expressSessionMiddleware as express.Handler);
    app.use(passport.initialize());
    app.use(passport.session());
  } else {
    console.log("Skipping session store setup...");
  }

  app.use((req, res, next) => {
    // This is before we've loaded req.devflags - just use the hard-coded default for the core team email domain.
    if (
      isCoreTeamEmail(req.user?.email, DEVFLAGS) ||
      req.path.includes("/server-data") ||
      ROUTES_WITH_TIMING.some((route) => req.path.includes(route))
    ) {
      req.timingStore = { calls: [], cur: undefined };
      ASYNC_TIMING.enterWith(req.timingStore);
    }
    next();
  });

  // Initialize some book-keeping stuff
  app.use(
    safeCast<RequestHandler>(async (req: Request, res, next) => {
      req.id = mkShortId();
      req.statsd = new WabPromStats(name);
      req.statsd.onReqStart(req);
      res.on("finish", () => {
        req.statsd.onReqEnd(req, res);
      });
      req.promLabels = {};
      next();
    })
  );

  app.use(
    promMetrics({
      customLabels: {
        route: null,
        projectId: null,
        // Also keep track of url for codegen, as the set of
        // urls codegen uses is reasonably small
        ...(name === "codegen" && {
          url: null,
        }),
      },
      includeMethod: true,
      includeStatusCode: true,
      includePath: true,
      transformLabels: (labels, req, _res) => {
        labels.route = req.route?.path;
        if (name === "codegen") {
          labels.url = req.originalUrl;
        }
        Object.assign(labels, req.promLabels ?? {});
      },
      promClient: {
        collectDefaultMetrics: {},
      },
      buckets: [
        0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15, 20, 30, 40, 65, 80, 100, 130,
        160, 180,
      ],
    })
  );

  // TODO I don't know why making this non-async causes node to crash-exit on any
  //  route error. Leaving it in results in double-reporting the error, but no
  //  other bad effects seemingly. Some interaction with our end handlers.
  app.use(
    safeCast<RequestHandler>(async (req, res, next) => {
      req.config = config;
      req.con = connectionPool;
      req.tsSvc = tsSvc;

      req.mailer = createMailer();
      req.activeTransaction = req.con
        .transaction((txMgr) => {
          return new Promise((resolve, reject) => {
            let fulfilled = false;

            req.txMgr = txMgr;
            req.resolveTransaction = async () => {
              if (fulfilled) {
                return;
              }
              fulfilled = true;
              resolve(undefined);
              await req.activeTransaction;
            };
            req.rejectTransaction = async (err) => {
              if (fulfilled) {
                return;
              }
              fulfilled = true;
              reject(err);
              await req.activeTransaction;
            };

            // The finish event is emitted "when the last segment of the response
            // headers and body have been handed off to the operating system for
            // transmission over the network."
            // https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_event_finish
            // This means once the response to the client is out of our hands, we
            // commit - which can fail:
            // https://stackoverflow.com/questions/33674370/can-committing-an-transaction-in-postgresql-fail
            // Thus, our response to the client may be incorrect. This is important
            // to keep in mind when configuring the database and cluster (e.g. if
            // you want to use a deferred constraint).
            //
            // We currently use this as a fallback. Hopefully we've already
            // committed in our end handlers. But there may be some routes that do
            // not end up next-ing into our end handlers (haven't exhaustively
            // checked).
            res.on("finish", () => {
              if (!fulfilled) {
                console.warn(
                  `[${
                    req.id
                  }]: connection finished before response fulfilled! ${
                    req.startTime
                      ? `${
                          Number(process.hrtime.bigint() - req.startTime) / 1e6
                        }ms after request started`
                      : ""
                  }`
                );
                reject(
                  new Error(
                    "Connection finished before response fulfilled - rolling back DB changes!"
                  )
                );
              } else {
                resolve(undefined);
              }
            });
            // If the connection was terminated without response.end() being called,
            // the "close" event will fire (e.g. when using the static middleware
            // below, or I think in some errors) and the "finish" event may or may
            // not fire. We still need to close the transaction so the connection
            // can be returned to the pool (which is currently at the default size
            // of 10). It may be sufficient to just handle "close" and not "finish"
            // but I'm not sure.
            //
            // Again, we are only using this as a fallback. Hopefully we've already
            // committed in our end handlers.
            res.on("close", () => {
              if (!fulfilled) {
                res.isClosedBeforeFulfilled = true;
                console.warn(
                  `[${req.id}]: connection closed before response fulfilled!  ${
                    req.startTime
                      ? `${
                          Number(process.hrtime.bigint() - req.startTime) / 1e6
                        }ms after request started`
                      : ""
                  }`
                );
                reject(
                  new Error(
                    "Connection closed before response fulfilled - rolling back DB changes!"
                  )
                );
              } else {
                resolve(undefined);
              }
            });
            next();
          });
        })
        .catch((err) => {
          // This can happen for two reasons.  One is that the request
          // failed with some exception, and the error handler in
          // withNext() called next(err), and so addEndErrorHandlers
          // rejected the transaction. The other is the the http connection
          // is closed before anyone called resolve or reject transaction,
          // and so the res.on("close") handler above rejected the transaction.
          // In either case, there is nothing for us to do here, as the
          // error has already been handled. We are here just to prevent
          // the error to continue propagating to the top level, uncaught
        });
    })
  );
  app.use(
    safeCast<RequestHandler>(
      async (req: Request, res: Response, next: NextFunction) => {
        req.bundler = new Bundler();
        next();
      }
    )
  );
  app.use(
    safeCast<ErrorRequestHandler>(
      async (err: Error, req: Request, res: Response, next: NextFunction) => {
        if (err) {
          // Gracefully logout/reset session if bad session
          await doLogout(req);
          next(err);
        } else {
          next();
        }
      }
    )
  );
  app.use(safeCast<RequestHandler>(authRoutes.authApiTokenMiddleware));
  if (!opts?.skipSession) {
    const csrf = lusca.csrf();
    app.use((req, res, next) => {
      if (isCsrfFreeRoute(req.path) || authRoutes.isPublicApiRequest(req)) {
        // API requests also don't need csrf
        return next();
      } else {
        return csrf(req, res, next);
      }
    });
  } else {
    console.log("Skipping CSRF setup...");
  }
  app.analytics = new Analytics(getSegmentWriteKey());

  // Parse body further down to prevent unauthorized users from incurring large parses.
  app.use(bodyParser.json({ limit: "400mb" }));
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    // Just these two pages can be inside iframes, and only on studio.plasmic.app
    const baseName = path.basename(req.path);
    const isInnerFrame = baseName === "host.html";
    res.set("X-Frame-Options", isInnerFrame ? "SAMEORIGIN" : "DENY");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(
    safeCast<RequestHandler>(async (req, res, next) => {
      const mgr = superDbMgr(req);
      const merged = await getDevFlagsMergedWithOverrides(mgr);
      req.devflags = merged;
      next();
    })
  );

  const workerpool = createWorkerPool();
  app.use(
    safeCast<RequestHandler>(async (req, res, next) => {
      req.workerpool = workerpool;
      next();
    })
  );
}

function addStaticRoutes(app: express.Application) {
  app.use(cors(), express.static("build"));
  app.use(cors(), express.static("public"));
}

export function addProxyRoutes(app: express.Application) {
  // Only proxy to the Shopify store if we are using a recognized domain.
  app.use("*", (req, res, next) => {
    const hostname = req.hostname;
    if (
      !req.devflags.proxyDomainSuffixes.some((suffix) =>
        hostname.endsWith(suffix)
      )
    ) {
      return next();
    }

    return withNext((req2, res2, next2) => {
      spawn(proxyToShopify(req2, res2, next2));
    })(req, res, next);
  });
}

export function addCmsPublicRoutes(app: express.Application) {
  // "Public" CMS API, access via API auth

  app.options("/api/v1/cms/*", corsPreflight());
  app.get(
    "/api/v1/cms/databases/:dbId",
    cors(),
    apiAuth,
    cachePublicCmsRead,
    withNext(getDatabase)
  );
  app.get(
    "/api/v1/cms/databases/:dbId/tables/:tableIdentifier/query",
    cors(),
    apiAuth,
    cachePublicCmsRead,
    withNext(queryTable)
  );

  app.get(
    "/api/v1/cms/databases/:dbId/tables/:tableIdentifier/count",
    cors(),
    apiAuth,
    cachePublicCmsRead,
    withNext(countTable)
  );

  app.put(
    "/api/v1/cms/databases/:dbId/tables",
    apiAuth,
    withNext(upsertDatabaseTables)
  );
  app.post(
    "/api/v1/cms/databases/:dbId/tables/:tableIdentifier/rows",
    withNext(publicCreateRows)
  );
  app.post("/api/v1/cms/rows/:rowId/publish", withNext(publicPublishRow));
  app.put("/api/v1/cms/rows/:rowId", withNext(publicUpdateRow));
  app.delete("/api/v1/cms/rows/:rowId", withNext(publicDeleteRow));
}

export function addCmsEditorRoutes(app: express.Application) {
  // CMS API for use by studio to crud; access by usual browser login
  app.get("/api/v1/cmse/databases", withNext(listDatabases));
  app.post("/api/v1/cmse/databases", withNext(createDatabase));
  app.get(
    "/api/v1/cmse/databases/:dbId",
    withNext(getCmsDatabaseAndSecretTokenById)
  );
  app.get("/api/v1/cmse/databases-meta/:dbId", withNext(getDatabaseMeta));
  app.get("/api/v1/cmse/databases-meta", withNext(listDatabasesMeta));
  app.put("/api/v1/cmse/databases/:dbId", withNext(updateDatabase));
  app.delete("/api/v1/cmse/databases/:dbId", withNext(deleteDatabase));

  app.post("/api/v1/cmse/databases/:dbId/tables", withNext(createTable));
  app.put("/api/v1/cmse/tables/:tableId", withNext(updateTable));
  app.delete("/api/v1/cmse/tables/:tableId", withNext(deleteTable));

  app.get("/api/v1/cmse/tables/:tableId/rows", withNext(listRows));
  app.post("/api/v1/cmse/tables/:tableId/rows", withNext(createRows));
  app.post(
    "/api/v1/cmse/tables/:tableId/trigger-webhook",
    withNext(triggerTableWebhooks)
  );

  app.get("/api/v1/cmse/rows/:rowId", withNext(getCmseRow));
  app.get("/api/v1/cmse/rows/:rowId/revisions", withNext(listRowRevisions));
  app.put("/api/v1/cmse/rows/:rowId", withNext(updateRow));
  app.delete("/api/v1/cmse/rows/:rowId", withNext(deleteRow));
  app.get("/api/v1/cmse/row-revisions/:revId", withNext(getRowRevision));

  app.post(
    "/api/v1/cmse/file-upload",
    fileUpload({
      limits: {
        files: 8,
        fileSize: 8 * 1024 * 1024, // 8MB
      },
    }),
    withNext(cmsFileUpload)
  );
}

export function addWhiteLabelRoutes(app: express.Application) {
  app.post(
    "/api/v1/wl/:whiteLabelName/users",
    safeCast<RequestHandler>(authRoutes.teamApiAuth),
    withNext(createWhiteLabelUser)
  );
  app.get(
    "/api/v1/wl/:whiteLabelName/users/:externalUserId",
    safeCast<RequestHandler>(authRoutes.teamApiAuth),
    withNext(getWhiteLabelUser)
  );
  app.delete(
    "/api/v1/wl/:whiteLabelName/users/:externalUserId",
    safeCast<RequestHandler>(authRoutes.teamApiAuth),
    withNext(deleteWhiteLabelUser)
  );
  app.get("/api/v1/wl/:whiteLabelName/open", withNext(openJwt));
}

export function addIntegrationsRoutes(app: express.Application) {
  app.options(
    "/api/v1/server-data/sources/:dataSourceId/execute",
    corsPreflight()
  );
  app.post(
    "/api/v1/server-data/sources/:dataSourceId/execute",
    cors(),
    withNext(executeDataSourceOperationHandler)
  );
}

export function addDataSourceRoutes(app: express.Application) {
  app.get("/api/v1/data-source/sources", withNext(listDataSources));
  app.get(
    "/api/v1/data-source/sources/:dataSourceId",
    withNext(getDataSourceById)
  );
  app.post("/api/v1/data-source/sources", withNext(createDataSource));
  app.post(
    "/api/v1/data-source/sources/test",
    withNext(testDataSourceConnection)
  );
  app.put(
    "/api/v1/data-source/sources/:dataSourceId",
    withNext(updateDataSource)
  );
  app.delete(
    "/api/v1/data-source/sources/:dataSourceId",
    withNext(deleteDataSource)
  );
  app.options("/api/v1/data-source/sources/:dataSourceId", corsPreflight());
  app.post(
    "/api/v1/data-source/sources/:dataSourceId",
    cors(),
    withNext(executeDataSourceStudioOperationHandler)
  );
  app.post(
    "/api/v1/data-source/sources/:dataSourceId/op-id",
    withNext(getDataSourceOperationId)
  );
  app.post(
    "/api/v1/data-source/sources/:dataSourceId/execute-studio",
    withNext(executeDataSourceOperationHandlerInStudio)
  );
  app.post(
    "/api/v1/data-source/sources/:dataSourceId/allow",
    withNext(allowProjectToDataSource)
  );
  // app.post("/api/v1/data-source/token", withNext(generateTemporaryToken));
  // app.delete("/api/v1/data-source/token", withNext(revokeTemporaryToken));

  // Bases endpoints

  app.get("/api/v1/data-source/airtable/bases", withNext(listAirtableBases));
}

export function addAnalyticsRoutes(app: express.Application) {
  app.get("/api/v1/analytics/team/:teamId", withNext(getAnalyticsForTeam));
  app.get(
    "/api/v1/analytics/team/:teamId/project/:projectId",
    withNext(getAnalyticsForProject)
  );
  app.get(
    "/api/v1/analytics/team/:teamId/project/:projectId/meta",
    withNext(getAnalyticsProjectMeta)
  );
  app.get(
    "/api/v1/analytics/team/:teamId/billing",
    withNext(getAnalyticsBillingInfoForTeam)
  );
}

export function addAppAuthRoutes(app: express.Application) {
  // App-auth Oauth
  app.get("/api/v1/app-auth/code", withNext(issueOauthCode));

  app.options("/api/v1/app-auth/token", corsPreflight());
  app.get("/api/v1/app-auth/token", cors(), withNext(grantOauthToken));

  app.options("/api/v1/app-auth/userinfo", corsPreflight());
  app.get("/api/v1/app-auth/userinfo", cors(), withNext(getEndUserByToken));

  app.post("/api/v1/app-auth/user", cors(), withNext(upsertEndUser));
}

export function addEndUserManagementRoutes(app: express.Application) {
  /**
   * App auth config
   */
  app.post(
    "/api/v1/end-user/app/:projectId/config",
    withNext(upsertAppAuthConfig)
  );
  app.get(
    "/api/v1/end-user/app/:projectId/pub-config",
    withNext(getAppAuthPubConfig)
  );
  app.get("/api/v1/end-user/app/:projectId/config", withNext(getAppAuthConfig));
  app.delete(
    "/api/v1/end-user/app/:projectId/config",
    withNext(deleteAppAuthConfig)
  );

  /**
   * Roles
   */
  app.get("/api/v1/end-user/app/:projectId/roles", withNext(listRoles));
  app.post("/api/v1/end-user/app/:projectId/roles", withNext(createRole));
  app.put(
    "/api/v1/end-user/app/:projectId/roles-orders",
    withNext(changeAppRolesOrder)
  );
  app.put(
    "/api/v1/end-user/app/:projectId/roles/:roleId",
    withNext(updateAppRole)
  );
  app.delete(
    "/api/v1/end-user/app/:projectId/roles/:roleId",
    withNext(deleteAppRole)
  );

  /**
   * User access to an app
   */
  app.get(
    "/api/v1/end-user/app/:projectId/access-rules",
    withNext(listAppAccessRules)
  );
  app.post(
    "/api/v1/end-user/app/:projectId/access-rules",
    withNext(createAccessRules)
  );
  app.put(
    "/api/v1/end-user/app/:projectId/access-rules/:accessId",
    withNext(updateAccessRule)
  );
  app.delete(
    "/api/v1/end-user/app/:projectId/access-rules/:accessId",
    withNext(deleteAccessRule)
  );
  app.get(
    "/api/v1/end-user/app/:projectId/user-role/:endUserId",
    withNext(getUserRoleInApp)
  );

  /**
   * Directory manangement
   */
  app.post(
    "/api/v1/end-user/teams/:teamId/directory",
    withNext(createEndUserDirectory)
  );
  app.get(
    "/api/v1/end-user/directories/:directoryId",
    withNext(getEndUserDirectory)
  );
  app.put(
    "/api/v1/end-user/directories/:directoryId",
    withNext(updateEndUserDirectory)
  );
  app.get(
    "/api/v1/end-user/directories/:directoryId/apps",
    withNext(getEndUserDirectoryApps)
  );
  app.get(
    "/api/v1/end-user/directories/:directoryId/users",
    withNext(getDirectoryUsers)
  );
  app.delete(
    "/api/v1/end-user/directories/:directoryId",
    withNext(deleteDirectory)
  );
  app.get(
    "/api/v1/end-user/teams/:teamId/directories",
    withNext(listTeamEndUserDirectories)
  );

  /**
   * End user management
   * */
  app.post(
    "/api/v1/end-user/directories/:directoryId/users",
    withNext(addDirectoryEndUsers)
  );
  app.put(
    "/api/v1/end-user/directories/:directoryId/users/:userId/groups",
    withNext(updateEndUserGroups)
  );
  app.delete(
    "/api/v1/end-user/directories/:directoryId/users/:endUserId",
    withNext(removeEndUserFromDirectory)
  );

  /**
   * Directory Groups
   */
  app.get(
    "/api/v1/end-user/directories/:directoryId/groups",
    withNext(listDirectoryGroups)
  );
  app.post(
    "/api/v1/end-user/directories/:directoryId/groups",
    withNext(createDirectoryGroup)
  );
  app.delete(
    "/api/v1/end-user/directories/:directoryId/groups/:groupId",
    withNext(deleteDirectoryGroup)
  );
  app.put(
    "/api/v1/end-user/directories/:directoryId/groups/:groupId",
    withNext(updateDirectoryGroup)
  );

  /**
   * App access registry
   */
  app.get(
    "/api/v1/end-user/app/:projectId/access-registry",
    withNext(listAppAccessRegistries)
  );
  app.delete(
    "/api/v1/end-user/app/:projectId/access-registry/:accessId",
    withNext(deleteAppAccessRegister)
  );
  app.get("/api/v1/end-user/app/:projectId/app-users", withNext(listAppUsers));
  app.get(
    "/api/v1/end-user/app/:projectId/app-user",
    withNext(getInitialUserToViewAs)
  );

  /**
   * Disable app auth
   */
  app.delete("/api/v1/end-user/app/:projectId", withNext(disableAppAuth));

  /**
   * Current User Properties
   */
  app.get(
    "/api/v1/end-user/app/:projectId/user-props-config",
    withNext(getAppCurrentUserOpConfig)
  );
  app.post(
    "/api/v1/end-user/app/:projectId/user-props-config",
    withNext(upsertCurrentUserOpConfig)
  );
  app.post(
    "/api/v1/end-user/app/:projectId/user-props",
    withNext(getAppCurrentUserProperties)
  );
}

export function addDataServerRoutes(app: express.Application) {
  addCmsPublicRoutes(app);
}

export function addCodegenRoutes(app: express.Application) {
  app.post("/api/v1/code/resolve-sync", apiAuth, withNext(resolveSync));
  app.post("/api/v1/code/style-config", apiAuth, withNext(genStyleConfig));
  app.post("/api/v1/code/required-packages", withNext(requiredPackages));
  app.post(
    "/api/v1/code/latest-codegen-version",
    withNext(latestCodegenVersion)
  );

  // All project endpoints that are related to code generation
  app.post(
    "/api/v1/projects/:projectId/code/components",
    apiAuth,
    withNext(genCode)
  );
  app.post(
    "/api/v1/projects/:projectId/code/tokens",
    apiAuth,
    withNext(genStyleTokens)
  );
  app.post(
    "/api/v1/projects/:projectId/code/icons",
    apiAuth,
    withNext(genIcons)
  );
  app.post(
    "/api/v1/projects/:projectId/code/meta",
    apiAuth,
    withNext(getProjectMeta)
  );
  app.get("/api/v1/localization/gen-texts", withNext(genTranslatableStrings));

  // All endpoints under /loader are cors-enabled
  app.options("/api/v1/loader/*", corsPreflight());
  app.get(
    "/api/v1/loader/code/published",
    cors(),
    apiAuth,
    withNext(buildPublishedLoaderAssets)
  );
  app.get(
    "/api/v1/loader/code/versioned",
    cors(),
    apiAuth,
    withNext(buildVersionedLoaderAssets)
  );
  app.get(
    "/api/v1/loader/code/preview",
    cors(),
    apiAuth,
    withNext(buildLatestLoaderAssets)
  );
  app.get("/api/v1/loader/chunks", cors(), withNext(getLoaderChunk));
  app.get(
    "/api/v1/loader/html/published/:projectId/:component",
    cors(),
    apiAuth,
    withNext(buildPublishedLoaderHtml)
  );
  app.get(
    "/api/v1/loader/html/versioned/:projectId/:component",
    cors(),
    apiAuth,
    withNext(buildVersionedLoaderHtml)
  );
  app.get(
    "/api/v1/loader/html/preview/:projectId/:component",
    cors(),
    apiAuth,
    withNext(buildLatestLoaderHtml)
  );
  app.get(
    "/api/v1/loader/repr-v2/published/:projectId",
    cors(),
    apiAuth,
    withNext(buildPublishedLoaderReprV2)
  );
  app.get(
    "/api/v1/loader/repr-v2/versioned/:projectId",
    cors(),
    apiAuth,
    withNext(buildVersionedLoaderReprV2)
  );
  app.get(
    "/api/v1/loader/repr-v2/preview/:projectId",
    cors(),
    apiAuth,
    withNext(buildLatestLoaderReprV2)
  );
  app.get(
    "/api/v1/loader/repr-v3/published/:projectId",
    cors(),
    apiAuth,
    withNext(buildPublishedLoaderReprV3)
  );
  app.get(
    "/api/v1/loader/repr-v3/versioned/:projectId",
    cors(),
    apiAuth,
    withNext(buildVersionedLoaderReprV3)
  );
  app.get(
    "/api/v1/loader/repr-v3/preview/:projectId",
    cors(),
    apiAuth,
    withNext(buildLatestLoaderReprV3)
  );

  app.post(
    "/api/v1/loader/code/prefill/:pkgVersionId",
    cors(),
    // intentionally no apiAuth()
    withNext(prefillPublishedLoader)
  );

  app.get("/static/js/loader-hydrate.js", withNext(getHydrationScript));
  app.get(
    "/static/js/loader-hydrate.:hash.js",
    withNext(getHydrationScriptVersioned)
  );
}

export function addMainAppServerRoutes(app: express.Application) {
  app.use((req, res, next) => {
    console.log(req.ip);
    next();
  });

  /**
   * Primary app routes.
   */
  app.get(
    "/api/v1/error",
    withNext(() => {
      throw new Error("Raw test error");
    })
  );

  /**
   * Auth Routes
   */
  app.get("/api/v1/auth/csrf", withNext(authRoutes.csrf));
  app.post("/api/v1/auth/login", withNext(authRoutes.login));
  app.post("/api/v1/auth/sign-up", withNext(authRoutes.signUp));
  app.get("/api/v1/auth/self", withNext(authRoutes.self));
  app.post("/api/v1/auth/self", withNext(authRoutes.updateSelf));
  app.post(
    "/api/v1/auth/self/password",
    withNext(authRoutes.updateSelfPassword)
  );
  app.post("/api/v1/auth/logout", withNext(authRoutes.logout));
  app.post("/api/v1/auth/forgotPassword", withNext(authRoutes.forgotPassword));
  app.post("/api/v1/auth/resetPassword", withNext(authRoutes.resetPassword));
  app.post("/api/v1/auth/confirmEmail", withNext(authRoutes.confirmEmail));
  app.post(
    "/api/v1/auth/sendEmailVerification",
    withNext(authRoutes.sendEmailVerification)
  );
  app.get(
    "/api/v1/auth/getEmailVerificationToken",
    withNext(authRoutes.getEmailVerificationToken)
  );
  app.get("/api/v1/auth/google", withNext(authRoutes.googleLogin));
  app.get(
    "/api/v1/oauth2/google/callback",
    withNext(authRoutes.googleCallback)
  );
  app.get("/api/v1/auth/saml/login", withNext(authRoutes.samlLogin));
  app.get("/api/v1/auth/saml/test", withNext(authRoutes.isValidSamlEmail));
  app.post(
    "/api/v1/auth/saml/:tenantId/consume",
    withNext(authRoutes.samlCallback)
  );
  app.get("/api/v1/auth/sso/test", withNext(authRoutes.isValidSsoEmail));
  app.get("/api/v1/auth/sso/:tenantId/login", withNext(authRoutes.ssoLogin));
  app.get(
    "/api/v1/auth/sso/:tenantId/consume",
    withNext(authRoutes.ssoCallback)
  );
  app.get("/api/v1/auth/airtable", withNext(authRoutes.airtableLogin));
  app.get("/api/v1/auth/google-sheets", withNext(authRoutes.googleSheetsLogin));
  app.get(
    "/api/v1/oauth2/google-sheets/callback",
    withNext(authRoutes.googleSheetsCallback)
  );
  app.get(
    "/api/v1/oauth2/airtable/callback",
    withNext(authRoutes.airtableCallback)
  );
  app.get(
    "/api/v1/auth/integrations",
    withNext(authRoutes.getUserAuthIntegrations)
  );

  /**
   * Admin Routes
   */
  app.post("/api/v1/admin/user", adminOnly, withNext(adminRoutes.createUser));
  app.post(
    "/api/v1/admin/clone",
    adminOnly,
    withNext(adminRoutes.cloneProject)
  );
  app.post(
    "/api/v1/admin/revert-project-revision",
    adminOnly,
    withNext(adminRoutes.revertProjectRevision)
  );
  app.post(
    "/api/v1/admin/resetPassword",
    adminOnly,
    withNext(adminRoutes.resetPassword)
  );

  app.post(
    "/api/v1/admin/setPassword",
    adminOnly,
    withNext(adminRoutes.setPassword)
  );
  app.post(
    "/api/v1/admin/updateMode",
    adminOnly,
    withNext(adminRoutes.updateSelfAdminMode)
  );
  app.get("/api/v1/admin/users", adminOnly, withNext(adminRoutes.listUsers));
  app.get(
    "/api/v1/admin/feature-tiers",
    adminOnly,
    withNext(adminRoutes.listAllFeatureTiers)
  );
  app.put(
    "/api/v1/admin/feature-tiers",
    adminOnly,
    withNext(adminRoutes.addFeatureTier)
  );
  app.post(
    "/api/v1/admin/change-team-owner",
    adminOnly,
    withNext(adminRoutes.changeTeamOwner)
  );
  app.post(
    "/api/v1/admin/upgrade-personal-team",
    adminOnly,
    withNext(adminRoutes.upgradePersonalTeam)
  );
  app.post(
    "/api/v1/admin/reset-team-trial",
    adminOnly,
    withNext(adminRoutes.resetTeamTrial)
  );
  app.post("/api/v1/admin/teams", adminOnly, withNext(adminRoutes.listTeams));
  app.post(
    "/api/v1/admin/projects",
    adminOnly,
    withNext(adminRoutes.listProjects)
  );
  app.get(
    "/api/v1/admin/invite-requests",
    adminOnly,
    withNext(adminRoutes.listInviteRequests)
  );
  app.post(
    "/api/v1/admin/delete-project",
    adminOnly,
    withNext(adminRoutes.deleteProject)
  );
  app.delete(
    "/api/v1/admin/delete-project-and-revisions",
    adminOnly,
    withNext(adminRoutes.deleteProjectAndRevisions)
  );
  app.post(
    "/api/v1/admin/restore-project",
    adminOnly,
    withNext(adminRoutes.restoreProject)
  );
  app.post(
    "/api/v1/admin/change-project-owner",
    adminOnly,
    withNext(adminRoutes.updateProjectOwner)
  );
  app.get(
    "/api/v1/admin/whitelist",
    adminOnly,
    withNext(adminRoutes.getWhitelist)
  );
  app.post(
    "/api/v1/admin/whitelist",
    adminOnly,
    withNext(adminRoutes.addToWhitelist)
  );
  app.delete(
    "/api/v1/admin/whitelist",
    adminOnly,
    withNext(adminRoutes.removeWhitelist)
  );
  app.post(
    "/api/v1/admin/login-as",
    adminOnly,
    withNext(adminRoutes.adminLoginAs)
  );
  app.post("/api/v1/admin/invite", adminOnly, withNext(adminRoutes.invite));
  app.post(
    "/api/v1/admin/deactivate-user",
    adminOnly,
    withNext(adminRoutes.deactivateUser)
  );
  app.post(
    "/api/v1/admin/upgrade-team",
    adminOnly,
    withNext(adminRoutes.upgradeTeam)
  );
  app.get(
    "/api/v1/admin/devflags",
    adminOnly,
    withNext(adminRoutes.getDevFlagOverrides)
  );
  app.get(
    "/api/v1/admin/devflags/versions",
    adminOnly,
    withNext(adminRoutes.getDevFlagVersions)
  );
  app.put(
    "/api/v1/admin/devflags",
    adminOnly,
    withNext(adminRoutes.setDevFlagOverrides)
  );
  app.post(
    "/api/v1/admin/upsert-saml",
    adminOnly,
    withNext(adminRoutes.upsertSamlConfig)
  );
  app.post(
    "/api/v1/admin/upsert-sso",
    adminOnly,
    withNext(adminRoutes.upsertSsoConfig)
  );
  app.get(
    "/api/v1/admin/get-sso",
    adminOnly,
    withNext(adminRoutes.getSsoByTeam)
  );
  app.post(
    "/api/v1/admin/codesandbox-token",
    adminOnly,
    withNext(adminRoutes.updateCodeSandboxToken)
  );
  app.post(
    "/api/v1/admin/create-tutorial-db",
    adminOnly,
    withNext(adminRoutes.createTutorialDb)
  );
  app.post(
    "/api/v1/admin/reset-tutorial-db",
    adminOnly,
    withNext(adminRoutes.resetTutorialDb)
  );
  app.get(
    "/api/v1/admin/get-team-by-white-label-name",
    adminOnly,
    withNext(adminRoutes.getTeamByWhiteLabelName)
  );
  app.post(
    "/api/v1/admin/update-team-white-label-info",
    adminOnly,
    withNext(adminRoutes.updateTeamWhiteLabelInfo)
  );
  app.post(
    "/api/v1/admin/update-team-white-label-name",
    adminOnly,
    withNext(adminRoutes.updateTeamWhiteLabelName)
  );
  app.post(
    "/api/v1/admin/promotion-code",
    adminOnly,
    withNext(adminRoutes.createPromotionCode)
  );
  app.get(
    "/api/v1/admin/app-auth-metrics",
    adminOnly,
    withNext(adminRoutes.getAppAuthMetrics)
  );
  app.get(
    "/api/v1/admin/project/:projectId/app-meta",
    adminOnly,
    withNext(adminRoutes.getProjectAppMeta)
  );
  app.get(
    `/api/v1/admin/project/:projectId/rev`,
    adminOnly,
    withNext(adminRoutes.getLatestProjectRevision)
  );
  app.post(
    `/api/v1/admin/project/:projectId/rev`,
    adminOnly,
    withNext(adminRoutes.saveProjectRevisionData)
  );
  app.get(
    `/api/v1/admin/pkg-version/data`,
    adminOnly,
    withNext(adminRoutes.getPkgVersion)
  );
  app.post(
    `/api/v1/admin/pkg-version/:pkgVersionId`,
    adminOnly,
    withNext(adminRoutes.savePkgVersion)
  );

  /**
   * Self routes
   */
  app.get("/api/v1/app-config", withNext(getAppConfig));
  app.get("/api/v1/app-ctx", withNext(getAppCtx));

  /**
   * Pkg routes
   */
  app.get("/api/v1/latest-bundle-version", withNext(getLatestBundleVersion));
  app.get("/api/v1/plume-pkg", withNext(getPlumePkg));
  app.get("/api/v1/plume-pkg/versions", withNext(getPlumePkgVersionStrings));
  app.get("/api/v1/plume-pkg/latest", withNext(getLatestPlumePkg));
  app.get("/api/v1/pkgs/:pkgId", withNext(getPkgVersion));
  app.get(
    "/api/v1/pkgs/:pkgId/versions-without-data",
    withNext(listPkgVersionsWithoutData)
  );
  app.post("/api/v1/pkgs/:pkgId/update-version", withNext(updatePkgVersion));

  /**
   * Project routes
   */
  app.get(
    "/api/v1/projects",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(listProjects)
  );
  app.post("/api/v1/projects", withNext(createProject));
  app.post(
    "/api/v1/projects/create-project-with-hostless-packages",
    withNext(createProjectWithHostlessPackages)
  );
  app.post("/api/v1/projects/:projectId/clone", withNext(cloneProject));
  app.post(
    "/api/v1/templates/:projectId/clone",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(clonePublishedTemplate)
  );
  // Import includes capabilities to keep the project id, allow data source op issuing,
  // set project domains, thus we need to be more careful with it.
  app.post(
    "/api/v1/projects/import",
    adminOrDevelopmentEnvOnly,
    withNext(importProject)
  );
  app.post(
    "/api/v1/projects/:projectId/publish-codesandbox",
    withNext(publishCodeSandbox)
  );
  app.post(
    "/api/v1/projects/:projectId/share-codesandbox",
    withNext(shareCodeSandbox)
  );
  app.post(
    "/api/v1/projects/:projectId/detach-codesandbox",
    withNext(detachCodeSandbox)
  );
  app.get(
    "/api/v1/projects/:projectId/meta",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(getProjectMeta)
  );
  app.put(
    "/api/v1/projects/:projectId/meta",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(updateProjectMeta)
  );
  app.get(
    "/api/v1/projects/:projectId/branches",
    withNext(listBranchesForProject)
  );
  app.post("/api/v1/projects/:projectId/branches", withNext(createBranch));
  app.put(
    "/api/v1/projects/:projectId/branches/:branchId",
    withNext(updateBranch)
  );
  app.delete(
    "/api/v1/projects/:projectId/branches/:branchId",
    withNext(deleteBranch)
  );
  app.get("/api/v1/projects/:projectBranchId", withNext(getProjectRev));
  app.get(
    "/api/v1/projects/:projectId/revision-without-data",
    withNext(getProjectRevWithoutData)
  );
  app.get(
    "/api/v1/project-data/:projectId",
    adminOnly,
    withNext(getFullProjectData)
  );
  app.put("/api/v1/projects/:projectId", withNext(updateProject));
  app.delete(
    "/api/v1/projects/:projectId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(deleteProject)
  );
  app.put(
    "/api/v1/projects/:projectId/revert-to-version",
    withNext(revertToVersion)
  );
  app.put("/api/v1/projects/:projectId/update-host", withNext(updateHostUrl));
  app.delete("/api/v1/projects/:projectId/perm", withNext(removeSelfPerm));
  app.get("/api/v1/projects/:projectId/updates", withNext(getModelUpdates));
  app.post(
    "/api/v1/projects/:projectId/create-pkg",
    withNext(createPkgByProjectId)
  );
  app.get("/api/v1/projects/:projectId/pkg", withNext(getPkgByProjectId));
  app.post("/api/v1/projects/:projectId/publish", withNext(publishProject));
  app.get(
    "/api/v1/projects/:projectId/pkgs/:pkgVersionId/status",
    withNext(getPkgVersionPublishStatus)
  );
  app.post(
    "/api/v1/projects/:projectId/grant-revoke",
    withNext(changeProjectPermissions)
  );
  app.post(
    "/api/v1/projects/:projectBranchId/revisions/:revision",
    withNext(saveProjectRev)
  );
  app.post("/api/v1/merge", withNext(tryMergeBranch));
  app.post(
    "/api/v1/projects/:projectId/code/project-sync-metadata",
    apiAuth,
    withNext(getProjectSyncMetadata)
  );
  app.post(
    "/api/v1/projects/:projectId",
    cors(),
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    apiAuth,
    withNext(updateProjectData)
  );
  app.get(
    "/api/v1/projects/:projectId/versions",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(listProjectVersionsWithoutData)
  );

  addInternalRoutes(app);

  /**
   * Comment routes
   */
  app.get(
    "/api/v1/projects/:projectBranchId/comments",
    withNext(getCommentsForProject)
  );
  app.post(
    "/api/v1/projects/:projectBranchId/comments",
    withNext(postCommentInProject)
  );
  app.post(
    "/api/v1/comments/:commentId/reactions",
    withNext(addReactionToComment)
  );
  app.delete(
    "/api/v1/reactions/:reactionId",
    withNext(removeReactionFromComment)
  );
  app.put(
    "/api/v1/projects/:projectBranchId/notification-settings",
    withNext(updateNotificationSettings)
  );

  /**
   * Teams / Users routes
   */
  app.get("/api/v1/users/:userIds", withNext(getUsersById));
  app.get(
    "/api/v1/teams",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.listTeams)
  );
  app.post(
    "/api/v1/teams",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.createTeam)
  );
  app.get(
    "/api/v1/teams/:teamId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.getTeamById)
  );
  app.get(
    "/api/v1/teams/:teamId/meta",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.getTeamMeta)
  );
  app.get(
    "/api/v1/teams/:teamId/projects",
    withNext(teamRoutes.getTeamProjects)
  );
  app.get(
    "/api/v1/teams/:teamId/workspaces",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.getTeamWorkspaces)
  );
  app.put("/api/v1/teams/:teamId", withNext(teamRoutes.updateTeam));
  app.delete(
    "/api/v1/teams/:teamId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.deleteTeam)
  );
  app.post("/api/v1/teams/purgeUsers", withNext(teamRoutes.purgeUsersFromTeam));
  app.post("/api/v1/teams/:teamId/join", withNext(teamRoutes.joinTeam));
  app.post(
    "/api/v1/grant-revoke",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(teamRoutes.changeResourcePermissions)
  );
  app.get(
    "/api/v1/feature-tiers",
    withNext(teamRoutes.listCurrentFeatureTiers)
  );
  app.get("/api/v1/teams/:teamId/tokens", withNext(teamRoutes.listTeamTokens));
  app.post(
    "/api/v1/teams/:teamId/tokens",
    withNext(teamRoutes.createTeamToken)
  );
  app.delete(
    "/api/v1/teams/:teamId/tokens/:token",
    withNext(teamRoutes.revokeTeamToken)
  );

  /**
   * Refactoring operations.
   */
  app.post("/api/v1/refactor/find-free-vars", withNext(findFreeVars));

  /**
   * Workspaces routes.
   */
  app.post(
    "/api/v1/workspaces",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(createWorkspace)
  );
  app.get("/api/v1/workspaces/:workspaceId", withNext(getWorkspace));
  app.get("/api/v1/personal-workspace", withNext(getPersonalWorkspace));
  app.put("/api/v1/workspaces/:workspaceId", withNext(updateWorkspace));
  app.delete(
    "/api/v1/workspaces/:workspaceId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(deleteWorkspace)
  );

  app.get(
    "/api/v1/workspaces",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(getWorkspaces)
  );

  /**
   * Project webhooks.
   */
  app.post(
    "/api/v1/projects/:projectId/trigger-webhook",
    withNext(triggerProjectWebhook)
  );
  app.get("/api/v1/projects/:projectId/webhooks", withNext(getProjectWebhooks));
  app.post(
    "/api/v1/projects/:projectId/webhooks",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(createProjectWebhook)
  );
  app.put(
    "/api/v1/projects/:projectId/webhooks/:webhookId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(updateProjectWebhook)
  );
  app.delete(
    "/api/v1/projects/:projectId/webhooks/:webhookId",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(deleteProjectWebhook)
  );
  app.get(
    "/api/v1/projects/:projectId/webhooks/events",
    withNext(getProjectWebhookEvents)
  );

  app.post("/api/v1/fmt-code", withNext(fmtCode));
  app.get("/api/v1/clip/:clipId", withNext(getClip));
  app.put("/api/v1/clip/:clipId", withNext(putClip));

  app.get("/api/v1/settings/apitokens", withNext(apiTokenRoutes.listTokens));
  app.put("/api/v1/settings/apitokens", withNext(apiTokenRoutes.createToken));
  app.delete(
    "/api/v1/settings/apitokens/:token",
    withNext(apiTokenRoutes.revokeToken)
  );
  app.put(
    "/api/v1/settings/apitokens/emit/:initToken",
    withNext(apiTokenRoutes.emitToken)
  );

  // For mailing list subscriptions
  // allow subscription requests from anywhere (e.g. localhost or www.plasmic.app)
  app.options("/api/v1/mail/subscribe", cors() as any);
  app.post(
    "/api/v1/mail/subscribe",
    cors(),
    withNext(mailingListRoutes.subscribe)
  );

  /**
   * Fake data for demos and cypress tests.
   */
  app.get("/api/v1/demodata/tweets", withNext(getFakeTweets));
  app.get("/api/v1/demodata/tasks", withNext(getFakeTasks));
  app.get("/api/v1/demodata/plans", withNext(getFakePlans));
  app.get("/api/v1/demodata/blurbs", withNext(getFakeBlurbs));
  app.get("/api/v1/demodata/posts", withNext(getFakePosts));
  app.get("/api/v1/demodata/testimonials", withNext(getFakeTestimonials));

  /**
   * BigCommerce proxy for demos
   */
  // allow pre-flight request for CORS
  // https://stackoverflow.com/questions/33483675/getting-express-server-to-accept-cors-request
  app.options("/api/v1/bigcommerce/graphql", cors() as any);
  app.post("/api/v1/bigcommerce/graphql", cors(), withNext(bigCommerceGraphql));

  /**
   * Discourse SSO
   */
  app.get("/api/v1/auth/discourse-connect", withNext(discourseConnect));

  /**
   * GitHub integration.
   */
  app.post("/api/v1/github/connect", withNext(connectGithubInstallations));
  app.get("/api/v1/github/data", withNext(githubData));
  app.get(
    "/api/v1/github/detect/:owner/:repo",
    withNext(detectOptionsFromDirectory)
  );
  app.get("/api/v1/github/branches", withNext(githubBranches));
  app.post("/api/v1/github/repos", withNext(setupNewGithubRepo));
  app.put("/api/v1/github/repos", withNext(setupExistingGithubRepo));

  /**
   * Shopify integration.
   */
  app.get("/api/v1/auth/shopify", withNext(shopifyAuthStart));
  app.get("/api/v1/oauth2/shopify/callback", withNext(shopifyCallback));
  app.put("/api/v1/shopify/password", withNext(updateShopifyStorePassword));
  app.get("/api/v1/shopify/probe-access", withNext(probeCanAccessShopifyShop));

  app.get("/api/v1/shopify/products", apiAuth, withNext(getProducts));
  app.post("/api/v1/shopify/publish", apiAuth, withNext(publishShopifyPages));

  // Mandatory GDPR compliance webhooks.
  app.post(
    "/api/v1/shopify/webhooks/customer-data-request",
    cors(),
    withNext(emailWebhook)
  );
  app.post(
    "/api/v1/shopify/webhooks/customer-data-erasure",
    cors(),
    withNext(emailWebhook)
  );
  app.post(
    "/api/v1/shopify/webhooks/shop-data-erasure",
    cors(),
    withNext(emailWebhook)
  );

  /**
   * Project repositories.
   */
  app.get(
    "/api/v1/projects/:projectId/repositories",
    withNext(getProjectRepositories)
  );
  app.post("/api/v1/project_repositories", withNext(addProjectRepository));
  app.delete(
    "/api/v1/project_repositories/:projectRepositoryId",
    withNext(deleteProjectRepository)
  );
  app.post(
    "/api/v1/project_repositories/:projectRepositoryId/action",
    withNext(fireGitAction)
  );
  app.get(
    "/api/v1/project_repositories/:projectRepositoryId/latest-run",
    withNext(getLatestWorkflowRun)
  );
  app.get(
    "/api/v1/project_repositories/:projectRepositoryId/runs/:workflowRunId",
    withNext(getGitWorkflowJob)
  );

  /**
   * Trusted hosts
   */
  app.get(
    "/api/v1/hosts",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(getTrustedHostsForSelf)
  );
  app.post(
    "/api/v1/hosts",
    safeCast<RequestHandler>(authRoutes.teamApiUserAuth),
    withNext(addTrustedHost)
  );
  app.delete("/api/v1/hosts/:trustedHostId", withNext(deleteTrustedHost));

  app.post(
    "/api/v1/image/upload",
    fileUpload({
      limits: {
        files: 1,
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
    withNext(uploadImage)
  );

  /**
   * CMS
   */
  addCmsEditorRoutes(app);
  addCmsPublicRoutes(app);

  /**
   * White label user management
   */
  addWhiteLabelRoutes(app);

  /**
   * Promotion routes
   */
  app.get(
    "/api/v1/promo-code/:promoCodeId",
    cors(),
    withNext(getPromotionCodeById)
  );

  /**
   * Analytics
   */
  addAnalyticsRoutes(app);

  addDataSourceRoutes(app);
  addIntegrationsRoutes(app);

  /**
   * App auth
   */
  addAppAuthRoutes(app);

  /**
   * End user management
   */
  addEndUserManagementRoutes(app);

  addProxyRoutes(app);

  if (typeof jest === "undefined") {
    // Do not create the interval in unit tests, because it keeps running and
    // breaks later tests.
    const checkAndNotifyUpdates = () => {
      spawn(
        getConnection().transaction((entMgr) =>
          checkAndNofityHostlessVersion(new DbMgr(entMgr, SUPER_USER))
        )
      );
    };

    checkAndNotifyUpdates();
    setInterval(() => checkAndNotifyUpdates(), 1000 * 60);
  }
}

/**
 * Handle common types of errors that are thrown by DbMgr, transforming them
 * into ApiErrors that have proper HTTP codes.
 *
 * Really, we only want this to run after our normal route handlers, and not
 * transform errors thrown in (e.g.) our passport.deserializeUser handler.
 */
function addEndErrorHandlers(app: express.Application) {
  // This transforms certain known errors into proper response codes and JSON.
  // This is only called if there was previously a next(error).
  app.use(
    safeCast<ErrorRequestHandler>(
      async (
        origErr: Error,
        req: Request,
        res: Response,
        _next: NextFunction
      ) => {
        // Too noisy in CI to print AuthError all the time
        if (!(origErr instanceof AuthError)) {
          console.log(
            `ERROR! ${
              res.isClosedBeforeFulfilled ? `(before fulfillment)` : ""
            }; rollback`,
            origErr
          );
        }
        try {
          // This will rollback the transaction, and reject the promise, so we wrap
          // this in a try/catch
          await req.rejectTransaction(origErr);
        } catch {}
        if (res.headersSent || res.writableEnded) {
          logError(origErr, "Tried to edit closed response");
          return;
        }
        const err = transformErrors(origErr);
        if (isApiError(err)) {
          res
            .status(err.statusCode)
            .json({ error: { ...err, message: err.message } });
        } else {
          res.status(500).json({ error: { message: "Internal Server Error" } });
        }
      }
    )
  );
}

function addNotFoundHandler(app: express.Application) {
  app.use((req: Request, res: Response, _next: NextFunction) => {
    _next(new NotFoundError("Not Found"));
  });
}

export async function createApp(
  name: string,
  config: Config,
  tsSvc: TsSvc | undefined,
  addRoutes: (app: express.Application) => void,
  addCleanRoutes?: (app: express.Application) => void,
  opts?: {
    skipSession: boolean;
  }
): Promise<{ app: express.Application }> {
  const app = express();

  app.set("port", config.port || process.env.BACKEND_PORT || 3004);
  app.set("name", name);

  await getConnection().transaction(async (entMgr) => {
    const dbMgr = new DbMgr(entMgr, SUPER_USER);
    await ensureDevFlags(dbMgr);
    await setupPassport(dbMgr, config, DEVFLAGS);
  });

  // Sentry setup needs to be first
  addSentry(app, config);

  // Datadog docs say it needs to come before any routing.
  app.use(datadogMiddleware);

  if (config.production) {
    app.enable("trust proxy");
  }

  const expressSessionMiddleware = makeExpressSessionMiddleware(config);

  addCleanRoutes?.(app);

  addMiddlewares(app, name, config, expressSessionMiddleware, tsSvc, opts);

  if (!config.production) {
    addStaticRoutes(app);
  }

  addRoutes(app);

  // Only error middlewares will be called after this
  // Add ERROR handlers
  //

  // If we've fallen to here, then there was no route match;
  // throw a 404. We explicitly handle it here instead of letting
  // Express use its default 404 handler, so that we can handle
  // this error like any other error -- specifically, we will
  // clean up and reject the current transaction upon a 404 in
  // addEndErrorHandlers().
  addNotFoundHandler(app);

  // Sentry error handler must go after routes
  addSentryError(app, config);

  // On error, rollback transactions
  addEndErrorHandlers(app);

  if (!config.production) {
    app.use(errorHandler());
  }

  const pruneCache = () => {
    const conn = getConnection();
    spawn(prunePartialRevCache(conn.manager));
    spawn(pruneOldBundleBackupsCache(conn.manager));
  };

  // Call it before `setInterval` so there's no initial delay
  pruneCache();

  // Prune old cache every 2 hours
  setInterval(() => pruneCache(), 1000 * 60 * 60 * 2);

  // Don't leak infra info
  app.disable("x-powered-by");

  console.log(
    `Starting server with heap memory ${
      v8.getHeapStatistics().total_available_size / 1024 / 1024
    }MB`
  );

  trackPostgresPool(name);

  return { app };
}

function corsPreflight() {
  const corsHandler = cors({
    // set access-control-max-age to 30 days, so the browser doesn't even
    // issue preflight requests for a while
    maxAge: 30 * 24 * 60 * 60,
    allowedHeaders: "*",
  });

  const handler: express.RequestHandler = (req, res, next) => {
    // cors response should be very cacheable by Cloudfront
    res.set(
      "Cache-Control",
      `max-age=${30 * 24 * 60 * 60}, s-maxage=${30 * 24 * 60 * 60}`
    );
    corsHandler(req, res, next);
  };
  return handler;
}

export function makeExpressSessionMiddleware(config: Config) {
  return session({
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30-day sessions
      ...(config.production && {
        // Allow to be embedded into an iframe in prod.
        // It's also possible to do this in dev, but it's
        // a huge pain because secure:true must accompany
        // sameSite:none, which means you'd have to run
        // all the dev servers in https mode.
        sameSite: "none",
        secure: true,
      }),
    },
    // Trust the proxy in deciding whether we are in an https
    // connection. Because app server sits behind nginx, which
    // handles the https and holds just a plain http connection
    // to the app server, we need to trust that nginx is passing
    // along the right header to let us know that this is indeed
    // https, so that we can set secure cookies above.
    proxy: true,
    resave: false,
    saveUninitialized: true,
    secret: config.sessionSecret,
    store: new TypeormStore({
      // Don't clean up expired sessions for now till we figure out
      // why there's a spike here
      cleanupLimit: 0,
      // By not using a subquery, maybe less likely for deadlock
      limitSubquery: false,
      onError: () => {},
      //ttl: 86400,
    }).connect(getConnection().getRepository(ExpressSession)),
  });
}
