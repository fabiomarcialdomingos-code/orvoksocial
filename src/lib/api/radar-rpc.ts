import { Pool } from "pg";

// Only these server-side calls may create Radar records with APP_DATABASE_URL.
// The database derives the actor from an active, verified AuthSession; an
// actorId supplied in request JSON is never accepted by the SQL boundary.
export class RadarRpc {
  constructor(private readonly pool: Pool, private readonly sessionHash: string) {}

  async invite(targetId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT orvok_radar_invite($1,$2) AS id`, [this.sessionHash, targetId],
    );
    return result.rows[0]!.id;
  }

  async accept(invitationId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT orvok_radar_accept($1,$2) AS id`, [this.sessionHash, invitationId],
    );
    return result.rows[0]!.id;
  }

  async presentNotice(purpose: "SELF_ANSWER" | "BE_PREDICTED", acceptanceId?: string) {
    const result = await this.pool.query<{
      presentation_id: string;
      notice_version: string;
      notice_hash: string;
      notice_content: string;
    }>(purpose === "BE_PREDICTED"
      ? `SELECT * FROM orvok_radar_present_notice($1,$2::"ConsentPurpose",$3::uuid)`
      : `SELECT * FROM orvok_radar_present_notice($1,$2::"ConsentPurpose")`,
    purpose === "BE_PREDICTED" ? [this.sessionHash, purpose, acceptanceId] : [this.sessionHash, purpose]);
    const row = result.rows[0]!;
    return {
      presentationId: row.presentation_id,
      version: row.notice_version,
      contentHash: row.notice_hash,
      content: row.notice_content,
    };
  }

  async grant(acceptanceId: string, presentationId: string, scope: "PRIVATE" | "SHARED", noticeVersion: string, noticeHash: string) {
    const result = await this.pool.query<{ grant_id: string; consent_version: number }>(
      `SELECT * FROM orvok_radar_grant($1,$2,$3,$4::"VisibilityScope",$5,$6)`,
      [this.sessionHash, acceptanceId, presentationId, scope, noticeVersion, noticeHash],
    );
    return { id: result.rows[0]!.grant_id, version: result.rows[0]!.consent_version };
  }

  async revoke(grantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT orvok_radar_revoke($1,$2) AS id`, [this.sessionHash, grantId],
    );
    return result.rows[0]!.id;
  }

  async grantSelf(presentationId: string, noticeVersion: string, noticeHash: string) {
    const result = await this.pool.query<{ grant_id: string; consent_version: number }>(
      `SELECT * FROM orvok_radar_grant_self($1,$2,$3,$4)`, [this.sessionHash, presentationId, noticeVersion, noticeHash],
    );
    return { id: result.rows[0]!.grant_id, version: result.rows[0]!.consent_version };
  }

  async revokeSelf(grantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT orvok_radar_revoke_self($1,$2) AS id`, [this.sessionHash, grantId],
    );
    return result.rows[0]!.id;
  }

  async answer(questionId: string, optionId: string, grantId: string, supersedesId?: string) {
    const result = await this.pool.query<{ answer_id: string; answer_version: number }>(
      `SELECT * FROM orvok_radar_answer($1,$2,$3,$4,$5)`,
      [this.sessionHash, questionId, optionId, grantId, supersedesId ?? null],
    );
    return { id: result.rows[0]!.answer_id, version: result.rows[0]!.answer_version };
  }

  async predict(input: {
    targetId: string;
    questionVersionId: string;
    selfAnswerVersionId: string;
    grantId: string;
    probabilityVector: number[];
    supersedesId?: string | undefined;
  }) {
    const result = await this.pool.query<{ snapshot_id: string; consent_version: number }>(
      `SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [this.sessionHash, input.targetId, input.questionVersionId, input.selfAnswerVersionId,
        input.grantId, JSON.stringify(input.probabilityVector), input.supersedesId ?? null],
    );
    return { id: result.rows[0]!.snapshot_id, consentVersion: result.rows[0]!.consent_version };
  }

  async auditBlocked(action: string, objectType: string, objectId: string, reason: string) {
    await this.pool.query(`SELECT orvok_radar_audit_blocked($1,$2,$3,$4,$5)`,
      [this.sessionHash, action, objectType, objectId, reason]);
  }
}
