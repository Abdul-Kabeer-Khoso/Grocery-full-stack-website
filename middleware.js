const isLoggedIn = (req, res, next)=>{
    if(!req.isAuthenticated()){
        req.flash("error", "you must be logged in");
        return res.redirect("/product");
    }   
    next();
}

module.exports = {isLoggedIn};