const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const prisma = require('../utils/prismaClient');

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await prisma.user.findFirst({ 
            where: {
                OR: [
                    { googleId: profile.id },
                    { email: profile.emails[0].value }
                ]
            }
        });

        if (user) {
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId: profile.id, authProvider: 'google' }
                });
            }
            return done(null, user);
        }

        user = await prisma.user.create({
            data: {
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                password: 'google-oauth-' + Math.random().toString(36),
                emailVerified: true,
                authProvider: 'google',
                address: '',
                avatar: profile.photos?.[0]?.value || ''
            }
        });

        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));

// Facebook Strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await prisma.user.findFirst({ 
            where: {
                OR: [
                    { facebookId: profile.id },
                    { email: profile.emails?.[0]?.value || `${profile.id}@facebook.com` }
                ]
            }
        });

        if (user) {
            if (!user.facebookId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { facebookId: profile.id, authProvider: 'facebook' }
                });
            }
            return done(null, user);
        }

        user = await prisma.user.create({
            data: {
                name: profile.displayName,
                email: profile.emails?.[0]?.value || `${profile.id}@facebook.com`,
                facebookId: profile.id,
                password: 'facebook-oauth-' + Math.random().toString(36),
                emailVerified: true,
                authProvider: 'facebook',
                address: '',
                avatar: profile.photos?.[0]?.value || ''
            }
        });

        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));

module.exports = passport;