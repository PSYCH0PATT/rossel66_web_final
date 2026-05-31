import { z } from 'zod'

/** POST /api/releases */
export const releasePostSchema = z.object({
  title: z.string().min(1).max(500),
  artistId: z.string().min(1).max(64),
  releaseDate: z.string().min(1).max(32),
  upc: z.string().min(1).max(64),
  type: z.enum(['single', 'album', 'ep']).optional(),
  coverUrl: z.string().max(2000).optional(),
  tracks: z.array(z.record(z.string(), z.unknown())).optional(),
  status: z.string().max(64).optional(),
  featuredArtistIds: z.array(z.string()).optional(),
  featuredArtistNames: z.array(z.string()).optional(),
  koalaId: z.string().max(128).optional(),
  bandlinkUrl: z.string().max(2000).optional(),
})

/** PUT /api/releases/[id] — частичное обновление */
export const releasePutSchema = releasePostSchema.partial()

/** POST /api/artists */
export const artistPostSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
  name: z.string().min(1).max(256),
  email: z.string().max(256).optional(),
  avatarUrl: z.string().max(2000).optional(),
  vkMusicUrl: z.string().max(2000).optional(),
  yandexMusicUrl: z.string().max(2000).optional(),
  spotifyUrl: z.string().max(2000).optional(),
  fio: z.string().max(512).optional(),
  fioShort: z.string().max(256).optional(),
  contract: z.string().max(512).optional(),
  percentage: z.number().int().min(0).max(100).optional(),
})

/** PUT /api/artists */
export const artistPutSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1).max(128).optional(),
  password: z.string().min(1).max(256).optional(),
  currentPassword: z.string().max(256).optional(),
  name: z.string().min(1).max(256).optional(),
  email: z.string().max(256).optional(),
  vkMusicUrl: z.string().max(2000).optional(),
  yandexMusicUrl: z.string().max(2000).optional(),
  spotifyUrl: z.string().max(2000).optional(),
  avatarUrl: z.string().max(2000).optional(),
  fio: z.string().max(512).optional(),
  fioShort: z.string().max(256).optional(),
  contract: z.string().max(512).optional(),
  percentage: z.number().int().min(0).max(100).optional(),
  verified: z.boolean().optional(),
})

/** POST /api/analytics/sync */
export const analyticsSyncBodySchema = z.object({
  mode: z.enum(['7days', 'latest', 'all', 'today']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})
