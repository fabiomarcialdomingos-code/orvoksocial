import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {ExperienceContext} from './experience-routes';
import {apiJson,OperationalApiError} from './response';
import {TOPICS,RELATIONS,CATALOG_VERSION,CONSENT_VERSION,SELF_NOTICE,SHARE_NOTICE,INVITE_NOTICE,EMPTY_PREFERENCES,selectQuestions,type Round,type Relationship} from '../perspectives/model';
const relation=z.enum(Object.keys(RELATIONS) as [Relationship,...Relationship[]]);
const prefs=z.strictObject({interests:z.array(z.enum(Object.keys(TOPICS) as [keyof typeof TOPICS,...(keyof typeof TOPICS)[]])).max(10),age:z.number().int().min(13).max(120).nullable(),profession:z.string().trim().max(120),showAge:z.boolean(),showProfession:z.boolean()});
const day=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export async function handlePerspectiveRoute(ctx:ExperienceContext):Promise<Response|null>{
 const {route,path,method,actorId,pool,readBody}=ctx;
 if(!route.startsWith('/perspectives/'))return null;
 // New instrument remains a candidate. Never silently enable publication gates.
 if(!['development','test'].includes(process.env.APP_ENV??'')&&!(process.env.OFFICIAL_RADAR_CATALOG_ENABLED==='true'&&process.env.REAL_USER_HOMOLOGATION_ENABLED==='true'))throw new OperationalApiError(503,'TEST_CATALOG_IN_DEPLOYED_ENVIRONMENT');
 if(method==='GET'&&path.length===3&&path[1]==='profiles'){
  const r=await pool.query('SELECT orvok_perspective_profile($1::uuid) AS profile',[z.uuid().parse(path[2])]);if(!r.rows[0]?.profile)throw new OperationalApiError(404,'NOT_FOUND');return apiJson({profile:r.rows[0].profile});
 }
 if(route==='/perspectives/preferences'){
  if(method==='GET'){const r=await pool.query('SELECT interests,age,profession,"showAge","showProfession" FROM "PerspectivePreferences" WHERE "userId"=$1',[actorId]);return apiJson({preferences:r.rows[0]??EMPTY_PREFERENCES});}
  const b=prefs.parse(await readBody());b.interests=[...new Set(b.interests)];
  await pool.query('INSERT INTO "PerspectivePreferences"("userId",interests,age,profession,"showAge","showProfession") VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT("userId") DO UPDATE SET interests=EXCLUDED.interests,age=EXCLUDED.age,profession=EXCLUDED.profession,"showAge"=EXCLUDED."showAge","showProfession"=EXCLUDED."showProfession","updatedAt"=clock_timestamp()',[actorId,JSON.stringify(b.interests),b.age,b.profession,b.showAge,b.showProfession]);return apiJson({preferences:b});
 }
 if(route==='/perspectives/rounds'){
  if(method==='GET'){const r=await pool.query('SELECT id,kind,relationship,questions,answers,skipped,"sealedAt","createdAt" FROM "PerspectiveRound" WHERE "ownerId"=$1 ORDER BY "createdAt" DESC LIMIT 100',[actorId]);return apiJson({items:r.rows});}
  const b=z.strictObject({kind:z.enum(['initial','relationship','daily']),relationship:relation.default('geral'),accepted:z.literal(true)}).parse(await readBody());const c=await pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actorId]);
   const previous=await c.query<Round>('SELECT * FROM "PerspectiveRound" WHERE "ownerId"=$1 ORDER BY "createdAt" DESC',[actorId]);
   const existing=previous.rows.find(r=>b.kind==='initial'?r.kind==='initial':b.kind==='daily'?r.kind==='daily'&&day(new Date(r.createdAt))===day(new Date()):r.kind==='relationship'&&r.relationship===b.relationship&&!r.sealedAt);
   if(existing){await c.query('COMMIT');return apiJson({round:existing});}
   const pref=await c.query('SELECT interests FROM "PerspectivePreferences" WHERE "userId"=$1',[actorId]);const id=randomUUID();
   const questions=selectQuestions({seed:id,interests:pref.rows[0]?.interests??[],relationship:b.relationship,seen:b.kind==='daily'?previous.rows.flatMap(r=>[...r.questions.map(q=>q.id),...r.skipped]):[],count:b.kind==='daily'?3:12});
   if(!questions.length)throw new OperationalApiError(409,'NO_NEW_QUESTIONS');
   const r=await c.query('INSERT INTO "PerspectiveRound"(id,"ownerId",kind,relationship,"catalogVersion",questions,"consentVersion","consentText") VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,actorId,b.kind,b.relationship,CATALOG_VERSION,JSON.stringify(questions),CONSENT_VERSION,SELF_NOTICE]);await c.query('COMMIT');return apiJson({round:r.rows[0]},201);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 if(method==='POST'&&path[1]==='rounds'&&path.length===4){
  const id=z.uuid().parse(path[2]);const b=z.strictObject({questionId:z.string().max(60),optionId:z.string().max(40).optional()}).parse(await readBody());const c=await pool.connect();
  try{await c.query('BEGIN');const r=(await c.query<Round>('SELECT * FROM "PerspectiveRound" WHERE id=$1 AND "ownerId"=$2 FOR UPDATE',[id,actorId])).rows[0];
   if(!r)throw new OperationalApiError(404,'NOT_FOUND');if(r.sealedAt)throw new OperationalApiError(409,'CONFLICT');const q=r.questions.find(q=>q.id===b.questionId);if(!q)throw new OperationalApiError(422,'RULE_VIOLATION');
   if(path[3]==='answer'){if(!q.options.some(o=>o.id===b.optionId))throw new OperationalApiError(422,'RULE_VIOLATION');r.answers[q.id]=b.optionId!;}
   else if(path[3]==='skip'){
    if(r.answers[q.id])throw new OperationalApiError(409,'CONFLICT');
    const previous=await c.query<Round>('SELECT questions,skipped FROM "PerspectiveRound" WHERE "ownerId"=$1',[actorId]);
    const exclude=r.kind==='daily'?previous.rows.flatMap(x=>[...x.questions.map(q=>q.id),...x.skipped]):[...r.questions.map(q=>q.id),...r.skipped];
    const replacement=selectQuestions({seed:id+q.id,interests:[q.topic],relationship:r.relationship,count:1,seen:exclude})[0];if(!replacement)throw new OperationalApiError(409,'NO_NEW_QUESTIONS');r.skipped.push(q.id);r.questions=r.questions.map(x=>x.id===q.id?replacement:x);
   }else throw new OperationalApiError(404,'NOT_FOUND');
   const out=await c.query('UPDATE "PerspectiveRound" SET answers=$1,questions=$2,skipped=$3 WHERE id=$4 RETURNING *',[JSON.stringify(r.answers),JSON.stringify(r.questions),JSON.stringify(r.skipped),id]);await c.query('COMMIT');return apiJson({round:out.rows[0]});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 let action:string|null=null,data:Record<string,unknown>={};
 if(route==='/perspectives/connections'){
  if(method==='GET')action='list';else{data=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('people'),roundId:z.uuid(),relationship:relation.optional(),accepted:z.literal(true)}),z.strictObject({kind:z.literal('world'),eventId:z.uuid(),relationship:relation,accepted:z.literal(true)})]).parse(await readBody());data.notice=SHARE_NOTICE;action='create';}
 }else if(path[1]==='connections'&&path[2]){
  data.code=z.string().regex(/^[a-f0-9]{32}$/).parse(path[2]);if(method==='GET'&&path.length===3)action='read';
  if(method==='POST'&&path.length===4){action=z.enum(['accept','submit','revoke','message']).parse(path[3]);const raw=await readBody();
   if(action==='accept')data={...data,...z.strictObject({accepted:z.literal(true)}).parse(raw),notice:INVITE_NOTICE};
   if(action==='submit')data={...data,...z.strictObject({guesses:z.record(z.string().max(60),z.strictObject({optionId:z.string().min(1).max(40),confidence:z.number().min(.25).max(1)})).refine(x=>Object.keys(x).length<=12)}).parse(raw)};
   if(action==='message')data={...data,...z.strictObject({body:z.string().trim().min(1).max(1200)}).parse(raw)};
   if(action==='revoke')z.strictObject({}).parse(raw);
  }
 }
 if(action){const r=await pool.query('SELECT orvok_perspective_connections($1,$2::jsonb) AS result',[action,JSON.stringify(data)]);return apiJson(action==='list'?r.rows[0].result:{connection:r.rows[0].result},action==='create'?201:200);}
 throw new OperationalApiError(404,'NOT_FOUND');
}
