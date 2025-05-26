const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

module.exports = function(passport, db){
    passport.use(new LocalStrategy(
        {usernameField: 'email'},
        (email, password, done)=>{
            db.query('select * from Users where email = ?', [email], (err, result)=>{
                if(err) return done(err);

                if(result.length==0){
                    return done(null, false, {message: 'Incorrect username'});
                }

                const user= result[0];

                bcrypt.compare(password, user.userpassword, (err, isMatch) => {
                    if (err) return done(err);
                    if (!isMatch) return done(null, false, { message: 'Incorrect password' });
                    return done(null, user);
                });
                
                // const isMatch = await bcrypt.compare(password, user.userpassword);

                // if(!isMatch) {
                //     return done(null, false, {message: 'Incorrect password'});
                // }

                // return done(null, user); // user authenticated

            })
        }
    ))

    passport.serializeUser((user, done)=>{
        done(null, user.userId);
    })

    passport.deserializeUser((id, done)=>{
        db.query('select * from Users where userId = ?', [id], (err, result)=>{
            if(err) return done(err);
            done(null, result[0]); //User object attached to req.user
        })
    })
}