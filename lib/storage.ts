import fs from 'fs'
import path from 'path'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: 'admin' | 'artist'
  password: string
  createdAt: string
}

export interface Release {
  id: string
  title: string
  artistId: string
  releaseDate: string
  type: 'single' | 'album' | 'ep'
  coverUrl?: string
  tracks: Track[]
  createdAt: string
  updatedAt: string
  upc?: string
  featuredArtistIds?: string[]
  featuredArtistNames?: string[]
}

export interface Track {
  id: string
  title: string
  duration: string
  trackNumber: number
  featuredArtistIds?: string[]
  featuredArtistNames?: string[]
}

export interface Report {
  id: string
  quarter: string
  artistId: string
  artistName: string
  fileName: string
  filePath: string
  uploadedAt: string
  processed: boolean
}

export interface Activity {
  id: string
  type: 'release_added' | 'playlist_found' | 'report_received' | 'payment_sent' | 'user_data_updated' | 'reports_generated'
  userId: string
  userRole: 'artist' | 'admin'
  title: string
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

const DATA_DIR = path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const RELEASES_FILE = path.join(DATA_DIR, 'releases.json')
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json')
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(RELEASES_FILE)) {
  fs.writeFileSync(RELEASES_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(REPORTS_FILE)) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(ACTIVITIES_FILE)) {
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([], null, 2))
}

export function loadUsers(): User[] {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading users:', error)
    return []
  }
}

export function saveUsers(users: User[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
  } catch (error) {
    console.error('Error saving users:', error)
  }
}

export function loadReleases(): Release[] {
  try {
    const data = fs.readFileSync(RELEASES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading releases:', error)
    return []
  }
}

export function saveReleases(releases: Release[]): void {
  try {
    fs.writeFileSync(RELEASES_FILE, JSON.stringify(releases, null, 2))
  } catch (error) {
    console.error('Error saving releases:', error)
  }
}

export function addUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = loadUsers()
  const newUser: User = {
    ...user,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  }
  users.push(newUser)
  saveUsers(users)
  return newUser
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const users = loadUsers()
  const index = users.findIndex(user => user.id === id)
  if (index === -1) return null
  
  users[index] = { ...users[index], ...updates }
  saveUsers(users)
  return users[index]
}

export function deleteUser(id: string): boolean {
  const users = loadUsers()
  const index = users.findIndex(user => user.id === id)
  if (index === -1) return false
  
  users.splice(index, 1)
  saveUsers(users)
  return true
}

export function getUserById(id: string): User | null {
  const users = loadUsers()
  return users.find(user => user.id === id) || null
}

export function getUserByUsername(username: string): User | null {
  const users = loadUsers()
  return users.find(user => user.username === username) || null
}

export function getUserByEmail(email: string): User | null {
  const users = loadUsers()
  return users.find(user => user.email === email) || null
}

export function addRelease(release: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>): Release {
  const releases = loadReleases()
  const newRelease: Release = {
    ...release,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  releases.push(newRelease)
  saveReleases(releases)
  return newRelease
}

export function updateRelease(id: string, updates: Partial<Release>): Release | null {
  const releases = loadReleases()
  const index = releases.findIndex(release => release.id === id)
  if (index === -1) return null
  
  releases[index] = { 
    ...releases[index], 
    ...updates,
    updatedAt: new Date().toISOString()
  }
  saveReleases(releases)
  return releases[index]
}

export function deleteRelease(id: string): boolean {
  const releases = loadReleases()
  const index = releases.findIndex(release => release.id === id)
  if (index === -1) return false
  
  releases.splice(index, 1)
  saveReleases(releases)
  return true
}

export function getReleaseById(id: string): Release | null {
  const releases = loadReleases()
  return releases.find(release => release.id === id) || null
}

export function getReleasesByArtistId(artistId: string): Release[] {
  const releases = loadReleases()
  return releases.filter(release => release.artistId === artistId)
}

export function getAllReleases(): Release[] {
  return loadReleases()
}

export function getAllUsers(): User[] {
  return loadUsers()
}

// Helper function to get artist releases including featured releases
export function getArtistReleases(artistId: string): Release[] {
  const releases = loadReleases()
  return releases.filter(release => {
    // Check if artist is main artist
    if (release.artistId === artistId) return true
    
    // Check if artist is featured in the release
    if (release.featuredArtistIds?.includes(artistId)) return true
    
    // Check if artist is featured in any track
    return release.tracks.some(track => 
      track.featuredArtistIds?.includes(artistId)
    )
  })
}

// Helper function to get releases where artist is featured
export function getFeaturedReleases(artistId: string): Release[] {
  const releases = loadReleases()
  return releases.filter(release => {
    // Check if artist is featured in the release (but not main artist)
    if (release.artistId !== artistId && release.featuredArtistIds?.includes(artistId)) {
      return true
    }
    
    // Check if artist is featured in any track
    return release.tracks.some(track => 
      track.featuredArtistIds?.includes(artistId)
    )
  })
}

// Helper function to get all releases with their artist info
export function getReleasesWithArtists(): (Release & { artist: User | null })[] {
  const releases = loadReleases()
  const users = loadUsers()
  
  return releases.map(release => ({
    ...release,
    artist: users.find(user => user.id === release.artistId) || null
  }))
}

// Placeholder function for reports (if needed)
export function assignReportsToNewArtist(artistId: string, artistName: string): void {
  // This function would handle report assignment if reports system exists
}

// Reports functions
export function loadReports(): Report[] {
  try {
    const data = fs.readFileSync(REPORTS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading reports:', error)
    return []
  }
}

export function saveReports(reports: Report[]): void {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2))
  } catch (error) {
    console.error('Error saving reports:', error)
  }
}

// Activities functions
export function loadActivities(): Activity[] {
  try {
    const data = fs.readFileSync(ACTIVITIES_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error loading activities:', error)
    return []
  }
}

export function saveActivities(activities: Activity[]): void {
  try {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2))
  } catch (error) {
    console.error('Error saving activities:', error)
  }
}

export function addActivity(activity: Omit<Activity, 'id' | 'createdAt'>): Activity {
  const activities = loadActivities()
  const newActivity: Activity = {
    ...activity,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  }
  activities.unshift(newActivity) // Add to beginning for chronological order
  saveActivities(activities)
  return newActivity
}

export function getActivitiesByUserId(userId: string, limit: number = 10): Activity[] {
  const activities = loadActivities()
  return activities
    .filter(activity => activity.userId === userId)
    .slice(0, limit)
}

export function getActivitiesByRole(role: 'artist' | 'admin', limit: number = 10): Activity[] {
  const activities = loadActivities()
  return activities
    .filter(activity => activity.userRole === role)
    .slice(0, limit)
}

export function getAllActivities(limit: number = 50): Activity[] {
  const activities = loadActivities()
  return activities.slice(0, limit)
}