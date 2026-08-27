process.env.SESSION_SECRET = 'ufhuiyhf8uytr3hfrfryhfuhrfhihfiufrewihrfuewerwuyhuy348952u'

import { createSessionToken } from './src/lib/auth/session'

const token = createSessionToken({
  userId: '69fc3f890cecbe8ba3b6ae5b',
  roles: ['admin'],
})

console.log(token)
