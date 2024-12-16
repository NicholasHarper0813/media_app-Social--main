const User = require('../models/user');
const keys = require('../config/keys');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: keys.GoogleClientID,
    clientSecret: keys.GoogleClientSecret,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    console.log(profile);
    User.findOne({
        google: profile.id
    }).then((user) => {
        if(user)
        {
            done(null, user);
        }
        else
        {
            const newUser = 
            {
                google: profile.id,
                firstname: profile.name.givenName,
                lastname: profile.name.familyName,
                fullname: profile.displayName,
                email: profile.emails[0].value,
                image: profile.photos[0].value
            }
            
            new User(newUser).save()
            .then((user) => {
                done(null, user);
            })
        }
    })
  }
));
