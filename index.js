const express = require('express');
const app = express();

//Path Setup for views directory
const path = require('path');
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use('/public', express.static(path.join(__dirname, "public")));



app.get("/home", (req, res)=>{
    res.render('home.ejs');
})

app.listen(8080, ()=>{
    console.log("App is listening");
})



