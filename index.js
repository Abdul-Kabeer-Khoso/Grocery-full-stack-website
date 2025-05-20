const express = require('express');
const app = express();


//Path Setup for views directory
const path = require('path');
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use('/public', express.static(path.join(__dirname, "public")));
app.use(express.static('public'));


//uuid 
const {v4: uuidv4} = require('uuid');


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

//show all products
app.get("/product/all", (req, res)=>{
    let showProductQuery = 'select * from Products';
    try{
        connection.query(showProductQuery, (err, result)=>{
            let products = result;
            if(err){
                res.send(err);
            } else{
                res.render('allProducts.ejs', {products});
            }
        })
    }catch(err){
        res.send(err);
    }
})

//Show Cart 
app.get("/product/cart", (req, res)=>{
    res.render('cart.ejs');
})

//add new address
app.get("/product/address", (req, res)=>{
    res.render('addAddress.ejs');
})

// Details of Product
app.get("/product/:id", async (req, res)=>{
    let {id}= req.params;
    let findProductQuery = `select * from Products where productId = "${id.toString()}"`;
    let findRelatedProductsQuery = 'select * from Products where productCategory = ?'
    try{
        let productDetails =await connection.promise().query(findProductQuery);
        let myProductDetails = productDetails[0][0];
        let relatedProducts = await connection.promise().query(findRelatedProductsQuery, [myProductDetails.productCategory]);
        let myRelatedProducts = relatedProducts[0];
        if(productDetails && relatedProducts){
            res.render('productDetails.ejs', {product: myProductDetails, relatedProducts: myRelatedProducts})
        }
        else{
            res.send("There is something error in logic");
        }

    } catch(err){
        res.send(err);
    }
})

//Show Seller Products
app.get("/seller", (req, res)=>{
    let allProducts = 'select * from Products';
    try{
      connection.query(allProducts, (err, result)=>{
        res.render('seller.ejs', {result})
      })
    }catch(err){
        res.send(err);
    }

})


//Add Product
app.post("/seller/add", (req, res)=>{
    let {product} = req.body;
    let productId = uuidv4();
    let addQuery = "INSERT INTO Products (productId, productName, productCategory, productImage1, productReviews, productDescription, oldPrice, newPrice, inStock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE);"
    try{
        connection.query(addQuery, 
            [productId, product.productName, product.productCategory, product.image1URL, '4', product.productDescription, product.productOldPrice, product.productNewPrice, ], 
            (err, result)=>{
                 if(err){
                    res.send("There is something error in add product query");
                 }   
                 else{
                    res.redirect('/seller');
                 }
            })
    }catch(err){
        res.send(err);
    }
})



app.listen(8080, ()=>{
    console.log("App is listening");
})



