import { GET } from './app/api/releases/[id]/route'

async function main() {
  const req = new Request('http://localhost:3000/api/releases/release_1759097981609_154', {
    headers: {
      'cookie': 'session=test' // We'll bypass auth for a moment in the route? No, we can't easily.
    }
  })
}
