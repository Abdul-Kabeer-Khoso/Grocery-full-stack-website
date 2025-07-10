module.exports.isLoggedIn = (req, res, next)=>{
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in");
        return res.redirect("/user/login");
    }   
    next();
}

module.exports.saveRedirectUrl = (req, res, next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
}

module.exports.isAdmin = (req, res, next) => {
    if (!req.session.isAdmin) {
        req.flash("error", "Unauthorized access");
        return res.redirect("/seller/login");
    }
    next();
};