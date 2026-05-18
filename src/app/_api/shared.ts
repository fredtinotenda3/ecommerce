// Use the environment variable for API calls - NEVER use localhost during build
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL

if (!serverURL) {
  throw new Error('NEXT_PUBLIC_SERVER_URL environment variable is required')
}

export const GRAPHQL_API_URL = serverURL
