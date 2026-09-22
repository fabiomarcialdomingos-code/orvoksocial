export type RadarOrder = {
  invitedAt: Date;
  acceptedAt: Date;
  grantedAt: Date;
  answeredAt: Date;
  predictedAt: Date;
};

export function isRadarOrderValid(value: RadarOrder): boolean {
  return (
    value.invitedAt < value.acceptedAt &&
    value.acceptedAt < value.grantedAt &&
    value.grantedAt < value.answeredAt &&
    value.answeredAt < value.predictedAt
  );
}

// Only for a future-outcome flow. Radar target answers precede social predictions.
export function isPredictionBeforeOutcome(
  predictedAt: Date,
  outcomeKnownAt: Date,
): boolean {
  return predictedAt < outcomeKnownAt;
}
