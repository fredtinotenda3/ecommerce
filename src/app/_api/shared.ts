export const GRAPHQL_API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 
  (process.env.NEXT_BUILD ? process.env.NEXT_PUBLIC_SERVER_URL : 'http://localhost:3000')