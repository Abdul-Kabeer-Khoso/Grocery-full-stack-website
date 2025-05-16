const express = require('express');
const app = express();


//Path Setup for views directory
const path = require('path');
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use('/public', express.static(path.join(__dirname, "public")));
app.use(express.static('public'));


//MySQL setup
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'grocify_web',
    password: 'admin123'
})

//Home Page
app.get("/product", (req, res)=>{
    res.render('Products.ejs');
});

//Product
app.get("/product/:id", (req, res)=>{
    res.render("relatedProducts.ejs");
})

app.get("/seller", (req, res)=>{
    res.render("seller.ejs");
})

app.listen(8080, ()=>{
    console.log("App is listening");
})



