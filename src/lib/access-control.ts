/** Deny-by-default matrix for the operational foundation. No public social data is enabled. */
export type Role = "USER" | "MODERATOR" | "ADMIN" | "SYSTEM";
export type Resource =
  | "PROFILE"
  | "RADAR_ANSWER"
  | "RADAR_PREDICTION"
  | "RADAR_SNAPSHOT"
  | "CONSENT"
  | "DATA_REQUEST"
  | "NOTIFICATION"
  | "AUDIT"
  | "MODERATION"
  | "ADMIN_USER"
  | "PUBLIC_CONTENT"
  | "ANONYMIZED_AGGREGATE";
export type AccessAction = "READ" | "CREATE" | "UPDATE" | "DELETE";

export interface AccessRequest {
  role: Role;
  actorId?: string;
  resource: Resource;
  action: AccessAction;
  ownerId?: string;
  predictorId?: string;
  targetId?: string;
  recipientId?: string;
  visibility?: "PRIVATE" | "SHARED" | "PUBLIC" | "ANONYMIZED";
  consentActive?: boolean;
  anonymizationVerified?: boolean;
}

export function canAccess(request: AccessRequest): boolean {
  const { role, actorId, resource, action } = request;
  if (role === "SYSTEM") return true; // internal service identity; never a login role
  if (!actorId) return false;

  if (resource === "ADMIN_USER")
    return role === "ADMIN" && (action === "READ" || action === "UPDATE");
  if (resource === "MODERATION")
    return (role === "MODERATOR" || role === "ADMIN") &&
      (action === "READ" || action === "UPDATE");
  if (resource === "AUDIT") return role === "ADMIN" && action === "READ";
  if (resource === "PUBLIC_CONTENT") return false; // publication is outside this block
  if (resource === "ANONYMIZED_AGGREGATE")
    return action === "READ" && request.anonymizationVerified === true;

  const own = request.ownerId === actorId;
  if (resource === "PROFILE") return own && (action === "READ" || action === "UPDATE");
  if (resource === "RADAR_ANSWER") return own && (action === "READ" || action === "CREATE");
  if (resource === "CONSENT" || resource === "DATA_REQUEST")
    return own && (action === "READ" || action === "CREATE");
  if (resource === "NOTIFICATION")
    return request.recipientId === actorId && (action === "READ" || action === "UPDATE");

  if (resource === "RADAR_PREDICTION" || resource === "RADAR_SNAPSHOT") {
    if (action === "CREATE") return request.predictorId === actorId && request.consentActive === true;
    if (action !== "READ" || request.consentActive !== true) return false;
    if (request.visibility === "PRIVATE") return request.predictorId === actorId;
    if (request.visibility === "SHARED")
      return request.predictorId === actorId || request.targetId === actorId;
    return false;
  }
  return false;
}
