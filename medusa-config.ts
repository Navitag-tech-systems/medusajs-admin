import { loadEnv, defineConfig, Modules } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_ADMIN === "true",
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  modules: [
    {
      key: Modules.EVENT_BUS,
      resolve: '@medusajs/event-bus-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      key: Modules.CACHE,
      resolve: '@medusajs/cache-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      key: Modules.WORKFLOW_ENGINE,
      resolve: '@medusajs/workflow-engine-redis',
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },
    {
      key: Modules.AUTH,
      resolve: '@medusajs/medusa/auth',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/auth-emailpass',
            id: 'emailpass',
            options: {},
          },
          {
            resolve: './src/modules/firebase-auth',
            id: 'firebase',
            options: {
              credentialJsonPath: process.env.FIREBASE_CREDENTIALS_PATH || '/app/firebase-admin.json',
            },
          },
        ],
      },
    },
  ],
})
