const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const { URL } = require("url");
const { createApiRouter } = require("./backend/api-router");
const { createMemorySessionStore } = require("./backend/session-store");
const { createBackendProviderFromEnv } = require("./backend/providers");
const { createNativeRuntime } = require("./backend/native-runtime");
const { createPostgresDatabase } = require("./backend/db/postgres");

const PORT = Number(process.env.PORT || 3010);
const rendererDir = path.join(__dirname, "renderer");
const MIME_TYPES = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml" };

function send(response,statusCode,body,contentType="text/plain; charset=utf-8"){response.writeHead(statusCode,{"Content-Type":contentType});response.end(body);}
async function serveStaticFile(requestPath,response){const normalized=requestPath==="/"?"/index.html":requestPath;const filePath=path.join(rendererDir,normalized.replace(/^\/+/,""));const resolved=path.resolve(filePath);if(!resolved.startsWith(path.resolve(rendererDir))){send(response,403,"Forbidden");return;}try{const buffer=await fs.readFile(resolved);send(response,200,buffer,MIME_TYPES[path.extname(resolved).toLowerCase()]||"application/octet-stream");}catch(error){if(error.code==="ENOENT"){send(response,404,"Not Found");return;}throw error;}}

function createRequestHandler(options={}){
  const env=options.env||process.env;let provider=options.provider||null;let sessionStore=options.sessionStore||null;let services=options.services||{};
  if(options.database&&(!provider||!sessionStore||!services.schedule||!services.settings||!services.masterData||!services.members||!services.groupRoles||!services.archives||!services.scheduleExtra||!services.attendance||!services.meal)){
    const nativeRuntime=createNativeRuntime(options.database,{provider,sessionStore,identityRepository:options.identityRepository,accessRepository:options.accessRepository,scheduleRepository:options.scheduleRepository,settingsRepository:options.settingsRepository,masterDataRepository:options.masterDataRepository,memberRepository:options.memberRepository,groupRoleRepository:options.groupRoleRepository,scheduleService:options.scheduleService,settingsService:options.settingsService,masterDataService:options.masterDataService,memberService:options.memberService,memberServiceOptions:options.memberServiceOptions,groupRoleService:options.groupRoleService,archiveApi:options.archiveApi,scheduleExtraApi:options.scheduleExtraApi,attendanceApi:options.attendanceApi,mealApi:options.mealApi,sessionOptions:options.sessionOptions});
    provider=provider||nativeRuntime.provider;sessionStore=sessionStore||nativeRuntime.sessionStore;services={...nativeRuntime.services,...services};
  }
  provider=provider||createBackendProviderFromEnv(env,{fetchImpl:options.fetchImpl});
  if(!sessionStore&&String(env.NODE_ENV||"").toLowerCase()==="production")throw new Error("Production backend requires a persistent sessionStore");
  sessionStore=sessionStore||createMemorySessionStore();
  const secureCookies=options.secureCookies!==undefined?Boolean(options.secureCookies):String(env.NODE_ENV||"").toLowerCase()==="production";
  const apiRouter=createApiRouter({provider,sessionStore,services,secureCookies});
  return async function handleRequest(request,response){try{const url=new URL(request.url,`http://${request.headers.host||`127.0.0.1:${PORT}`}`);if(await apiRouter.handle(request,response,url))return;await serveStaticFile(url.pathname,response);}catch(error){console.error(error);send(response,500,JSON.stringify({error:error.message||"Server error"}),"application/json; charset=utf-8");}};
}
function startServer(port=PORT,options={}){const handler=createRequestHandler(options);const server=http.createServer((request,response)=>{handler(request,response);});server.listen(port,()=>{if(options.log===false)return;const address=server.address();const actualPort=address&&typeof address==="object"?address.port:port;console.log(`web server running at http://127.0.0.1:${actualPort}`);});return server;}

if(require.main===module){
  const hasDatabaseUrl=Boolean(String(process.env.DATABASE_URL||process.env.POSTGRES_URL||"").trim());
  const database=hasDatabaseUrl?createPostgresDatabase({env:process.env}):null;
  const server=startServer(PORT,database?{database}:{});
  const close=()=>server.close(async()=>{if(database)await database.close();process.exit(0);});
  process.once("SIGTERM",close);
  process.once("SIGINT",close);
}
module.exports={createRequestHandler,startServer};
