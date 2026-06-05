import {
  ANALYTICS_ALIAS_MIGRATION_MESSAGE,
  AnalyticsAliasTableMissingError,
  isAnalyticsAliasTableMissingError,
} from '@/lib/analytics-artist-match'

export function getAnalyticsMigrationHttpError(
  error: unknown
): { status: number; message: string } | null {
  if (
    error instanceof AnalyticsAliasTableMissingError ||
    isAnalyticsAliasTableMissingError(error)
  ) {
    return { status: 503, message: ANALYTICS_ALIAS_MIGRATION_MESSAGE }
  }
  return null
}
