const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

module.exports = function(passport, db){
    passport.use(new localStrategy(
        (username, password, done)=>{
            db.query('select * fromUsers where username = ?', [username], async (err, result)=>{
                if(err) return done(err);

                if(result.length==0){
                    return done(null, false, {message: 'Incorrect username'});
                }

                const user= result[0];
                
                const isMatch = await bcrypt.compare(password, user.password);

                if(!isMatch) {
                    return done(null, false, {message: 'Incorrect password'});
                }

                return done(null, user); // user authenticated

            })
        }
    ))

    passport.serializeUser((user, done)=>{
        done(null, user.id);
    })

    passport.deserializeUser((id, done)=>{
        db.query('select * from Users where userId = ?', [id], (err, result)=>{
            if(err) return done(err);
            done(null, result[0]); //User object attached to req.user
        })
    })
}