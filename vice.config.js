/**
 * VICE local audit — https://github.com/Webba-Creative-Technologies/vice
 * Do not point `supabaseMigrations` at `api/prisma/migrations`: the RLS module
 * targets Supabase/PostgREST. This API uses Nest + Prisma with server-side auth.
 */
module.exports = {
    ci: {
        minScore: 70,
    },
};
