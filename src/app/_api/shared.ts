<<<<<<< HEAD
export const GRAPHQL_API_URL = process.env.NEXT_BUILD
  ? `http://127.0.0.1:${process.env.PORT || 3000}`
  : process.env.NEXT_PUBLIC_SERVER_URL
=======
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

export const GRAPHQL_API_URL = serverURL
>>>>>>> a5bb40ed9878687f9c5c7dd9b3a827d497477a48
